const redis = require('redis');

// Redis configuration
const redisConfig = {
  development: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0,
  },
  production: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0,
  }
};

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.memoryStore = new Map(); // Fallback memory store
    this.connectionAttempted = false;
    this.isShuttingDown = false;
  }

  async connect() {
    // Prevent multiple connection attempts
    if (this.connectionAttempted || this.isShuttingDown) {
      return;
    }
    this.connectionAttempted = true;

    try {
      const config = redisConfig[process.env.NODE_ENV || 'development'];
      
      this.client = redis.createClient({
        socket: {
          host: config.host,
          port: config.port,
          connectTimeout: 3000, // 3 second timeout
          reconnectStrategy: false, // Disable auto-reconnect
        },
        password: config.password,
        database: config.db,
      });

      // Single error handler that only logs once
      let errorLogged = false;
      this.client.on('error', (err) => {
        if (!errorLogged && !this.isShuttingDown) {
          console.warn('⚠️ Redis not available, using memory store as fallback');
          errorLogged = true;
        }
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('✅ Redis connected successfully');
      });

      this.client.on('disconnect', () => {
        if (!this.isShuttingDown) {
          this.isConnected = false;
        }
      });

      // Attempt connection with timeout
      await Promise.race([
        this.client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 3000)
        )
      ]);
      
      // Test connection
      await this.client.ping();
      this.isConnected = true;
      console.log('✅ Redis connection established and tested');
      
    } catch (error) {
      if (!this.isShuttingDown) {
        console.warn('⚠️ Redis not available, using memory store:', error.message);
      }
      this.isConnected = false;
      this.client = null;
    }
  }

  async set(key, value, expireInSeconds = null) {
    if (this.isShuttingDown) return;
    
    try {
      if (this.isConnected && this.client) {
        if (expireInSeconds) {
          await this.client.setEx(key, expireInSeconds, JSON.stringify(value));
        } else {
          await this.client.set(key, JSON.stringify(value));
        }
      } else {
        // Fallback to memory store
        const item = {
          value: JSON.stringify(value),
          expiry: expireInSeconds ? Date.now() + (expireInSeconds * 1000) : null
        };
        this.memoryStore.set(key, item);
      }
    } catch (error) {
      if (!this.isShuttingDown) {
        // Silent fallback to memory store
        const item = {
          value: JSON.stringify(value),
          expiry: expireInSeconds ? Date.now() + (expireInSeconds * 1000) : null
        };
        this.memoryStore.set(key, item);
      }
    }
  }

  async get(key) {
    if (this.isShuttingDown) return null;
    
    try {
      if (this.isConnected && this.client) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        // Fallback to memory store
        const item = this.memoryStore.get(key);
        if (!item) return null;
        
        // Check if expired
        if (item.expiry && Date.now() > item.expiry) {
          this.memoryStore.delete(key);
          return null;
        }
        
        return JSON.parse(item.value);
      }
    } catch (error) {
      return null;
    }
  }

  async del(key) {
    if (this.isShuttingDown) return;
    
    try {
      if (this.isConnected && this.client) {
        await this.client.del(key);
      } else {
        this.memoryStore.delete(key);
      }
    } catch (error) {
      if (!this.isShuttingDown) {
        this.memoryStore.delete(key);
      }
    }
  }

  async incr(key, expireInSeconds = null) {
    if (this.isShuttingDown) return 0;
    
    try {
      if (this.isConnected && this.client) {
        const result = await this.client.incr(key);
        if (expireInSeconds && result === 1) {
          await this.client.expire(key, expireInSeconds);
        }
        return result;
      } else {
        // Fallback to memory store
        const current = await this.get(key) || 0;
        const newValue = current + 1;
        await this.set(key, newValue, expireInSeconds);
        return newValue;
      }
    } catch (error) {
      if (!this.isShuttingDown) {
        const current = await this.get(key) || 0;
        const newValue = current + 1;
        await this.set(key, newValue, expireInSeconds);
        return newValue;
      }
      return 0;
    }
  }

  async disconnect() {
    this.isShuttingDown = true;
    this.isConnected = false;
    
    if (this.client) {
      try {
        // Remove all listeners to prevent further events
        this.client.removeAllListeners();
        await this.client.quit();
      } catch (error) {
        // Force disconnect if quit fails
        try {
          await this.client.disconnect();
        } catch (disconnectError) {
          // Ignore any disconnect errors
        }
      }
      this.client = null;
    }
    
    this.memoryStore.clear();
  }

  // Get connection info for debugging
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      usingMemoryStore: !this.isConnected,
      memoryStoreSize: this.memoryStore.size,
      connectionAttempted: this.connectionAttempted,
      isShuttingDown: this.isShuttingDown
    };
  }
}

// Create singleton instance
const redisManager = new RedisManager();

module.exports = redisManager; 