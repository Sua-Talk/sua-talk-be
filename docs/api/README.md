# SuaTalk API Documentation

## 📁 Struktur Dokumentasi Modular

Dokumentasi API SuaTalk sekarang menggunakan struktur modular untuk memudahkan maintenance dan kolaborasi tim.

```
docs/api/
├── openapi-modular.yaml      # File utama (metadata + referensi)
├── openapi-bundled.yaml      # File hasil bundling (auto-generated)
├── openapi.yaml              # File lama (deprecated)
├── paths/                    # Definisi endpoint
│   ├── general.yaml          # Health check, root
│   ├── auth.yaml             # Authentication endpoints
│   ├── users.yaml            # User management
│   ├── babies.yaml           # Baby profile management
│   ├── audio.yaml            # Audio upload & processing
│   ├── ml.yaml               # ML analysis endpoints
│   └── keys.yaml             # API key management
├── schemas/                  # Data models
│   ├── common.yaml           # Error, success responses
│   ├── user.yaml             # User-related schemas
│   ├── baby.yaml             # Baby-related schemas
│   ├── audio.yaml            # Audio-related schemas
│   └── apikey.yaml           # API key schemas
├── responses/                # Reusable response definitions
│   └── common.yaml           # Standard HTTP responses
└── tools/                    # Automation scripts
    ├── bundle.js             # Bundling script
    └── pre-commit.js         # Git hook (optional)
```

## 🚀 Workflow Development

### 1. Edit Dokumentasi
Untuk menambah/mengubah dokumentasi endpoint:

```bash
# Edit file yang sesuai
vi docs/api/paths/auth.yaml       # Untuk endpoint auth
vi docs/api/schemas/user.yaml     # Untuk schema user
vi docs/api/responses/common.yaml # Untuk response standard
```

### 2. Bundle Dokumentasi
Setelah edit file modular, bundle menjadi satu file:

```bash
# Manual bundling
npm run bundle:docs

# Bundle + validate
npm run docs
```

### 3. Test Server
Pastikan server berjalan dengan dokumentasi baru:

```bash
npm run start
# Buka http://localhost:3000/api-docs
```

## 🔧 Script NPM Available

| Script | Fungsi |
|--------|--------|
| `npm run bundle:docs` | Bundle file modular menjadi satu |
| `npm run validate:bundled` | Validasi file bundled |
| `npm run docs` | Bundle + validate (recommended) |

## 📝 Best Practices

### ✅ DO:
- **Edit file modular** (`paths/`, `schemas/`, `responses/`)
- **Jalankan `npm run docs`** sebelum commit
- **Test di browser** setelah bundling
- **Gunakan `$ref`** untuk referensi antar file
- **Tambah examples** yang realistic

### ❌ DON'T:
- **Jangan edit `openapi-bundled.yaml`** (auto-generated)
- **Jangan pakai file `openapi.yaml` lama**
- **Jangan commit tanpa bundling**
- **Jangan bikin file > 500 lines** dalam satu modular file

## 🔄 Auto-bundling (Optional)

Untuk setup auto-bundling saat commit:

```bash
# Copy pre-commit hook
cp docs/api/tools/pre-commit.js .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## 🐛 Troubleshooting

### Error: "Could not resolve reference"
```bash
# Periksa path $ref di file modular
# Pastikan file yang direferensi ada
# Contoh: $ref: '../schemas/user.yaml#/TokenResponse'
```

### Error: "YAML syntax error"
```bash
# Validasi syntax YAML
npm run validate:bundled

# Atau gunakan online validator
# https://codebeautify.org/yaml-validator
```

### Server tidak load dokumentasi
```bash
# Pastikan bundling sukses
npm run bundle:docs

# Restart server
npm run start
```

## 📊 Benefits

- **🎯 Maintainable**: File kecil, mudah di-edit
- **👥 Collaborative**: Tim bisa edit bagian berbeda tanpa conflict
- **⚡ Performance**: Bundle mengoptimalkan load time
- **🔍 Scalable**: Mudah tambah endpoint baru
- **✅ Quality**: Auto-validation mencegah error

## 🔗 Resources

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Best Practices for API Documentation](https://swagger.io/resources/articles/best-practices-in-api-documentation/)
- [YAML Syntax Guide](https://docs.ansible.com/ansible/latest/reference_appendices/YAMLSyntax.html)

---

**Last updated**: *Auto-generated during bundling process* 