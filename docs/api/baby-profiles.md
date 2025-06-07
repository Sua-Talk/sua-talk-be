# Baby Profile API Documentation

## Overview
The Baby Profile API allows authenticated users to manage baby profiles including creating, reading, updating, deleting profiles and uploading photos. All endpoints require authentication and users can only access their own baby profiles.

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Base URL
```
/api/babies
```

## Endpoints

### 1. Create Baby Profile
**POST** `/api/babies`

Creates a new baby profile for the authenticated user.

#### Headers
- `Authorization: Bearer <jwt_token>` (required)
- `Content-Type: application/json`

#### Request Body
```json
{
  "name": "Emma Johnson",
  "birthDate": "2024-01-15T00:00:00.000Z",
  "gender": "female",
  "weight": {
    "birth": 3200,
    "current": 4500
  },
  "height": {
    "birth": 48,
    "current": 55
  },
  "feedingNotes": "Breastfeeding every 2-3 hours",
  "sleepNotes": "Sleeps 3-4 hours at a time",
  "allergies": ["dairy", "nuts"],
  "medications": [
    {
      "name": "Vitamin D drops",
      "dosage": "1 drop",
      "frequency": "daily"
    }
  ]
}
```

#### Required Fields
- `name` (string, 1-50 characters, letters and spaces only)
- `birthDate` (ISO 8601 date, not future, max 5 years old)
- `gender` (enum: "male", "female", "other", "prefer-not-to-say")

#### Optional Fields
- `weight.birth` (number, 500-8000g)
- `weight.current` (number, 500-50000g)
- `height.birth` (number, 20-80cm)
- `height.current` (number, 20-200cm)
- `feedingNotes` (string, max 500 characters)
- `sleepNotes` (string, max 500 characters)
- `allergies` (array of strings, max 100 characters each)
- `medications` (array of objects with name, dosage, frequency)

#### Success Response (201)
```json
{
  "success": true,
  "message": "Baby profile created successfully",
  "timestamp": "2025-06-07T04:00:00.000Z",
  "data": {
    "baby": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "Emma Johnson",
      "birthDate": "2024-01-15T00:00:00.000Z",
      "gender": "female",
      "age": {
        "years": 0,
        "months": 4,
        "days": 23,
        "weeks": 20
      },
      "weight": {
        "birth": 3200,
        "current": 4500
      },
      "height": {
        "birth": 48,
        "current": 55
      },
      "profilePicture": {
        "thumbnail": null,
        "medium": null,
        "original": null
      },
      "feedingNotes": "Breastfeeding every 2-3 hours",
      "sleepNotes": "Sleeps 3-4 hours at a time",
      "allergies": ["dairy", "nuts"],
      "medications": [
        {
          "name": "Vitamin D drops",
          "dosage": "1 drop",
          "frequency": "daily"
        }
      ],
      "createdAt": "2025-06-07T04:00:00.000Z",
      "updatedAt": "2025-06-07T04:00:00.000Z"
    }
  }
}
```

#### Error Responses
- **400 Bad Request**: Validation errors
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Account deactivated
- **429 Too Many Requests**: Rate limit exceeded

---

### 2. Get All Baby Profiles
**GET** `/api/babies`

Retrieves all baby profiles for the authenticated user.

#### Headers
- `Authorization: Bearer <jwt_token>` (required)

#### Success Response (200)
```json
{
  "success": true,
  "message": "Baby profiles retrieved successfully",
  "timestamp": "2025-06-07T04:00:00.000Z",
  "data": {
    "babies": [
      {
        "id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "name": "Emma Johnson",
        "birthDate": "2024-01-15T00:00:00.000Z",
        "gender": "female",
        "age": {
          "years": 0,
          "months": 4,
          "days": 23,
          "weeks": 20
        },
        "profilePicture": {
          "thumbnail": "/uploads/baby-photos/baby-60f7b3b3-1625097600000-thumb.webp",
          "medium": "/uploads/baby-photos/baby-60f7b3b3-1625097600000-medium.webp",
          "original": "/uploads/baby-photos/baby-60f7b3b3-1625097600000-original.webp"
        },
        "createdAt": "2025-06-07T04:00:00.000Z",
        "updatedAt": "2025-06-07T04:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

#### Error Responses
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Account deactivated

---

### 3. Get Baby Profile by ID
**GET** `/api/babies/:id`

Retrieves a specific baby profile by ID. User must own the baby profile.

#### Headers
- `Authorization: Bearer <jwt_token>` (required)

#### URL Parameters
- `id` (string, required): Baby profile ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Baby profile retrieved successfully",
  "timestamp": "2025-06-07T04:00:00.000Z",
  "data": {
    "baby": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "Emma Johnson",
      "birthDate": "2024-01-15T00:00:00.000Z",
      "gender": "female",
      "age": {
        "years": 0,
        "months": 4,
        "days": 23,
        "weeks": 20
      },
      "weight": {
        "birth": 3200,
        "current": 4500
      },
      "height": {
        "birth": 48,
        "current": 55
      },
      "profilePicture": {
        "thumbnail": "/uploads/baby-photos/baby-60f7b3b3-1625097600000-thumb.webp",
        "medium": "/uploads/baby-photos/baby-60f7b3b3-1625097600000-medium.webp",
        "original": "/uploads/baby-photos/baby-60f7b3b3-1625097600000-original.webp"
      },
      "feedingNotes": "Breastfeeding every 2-3 hours",
      "sleepNotes": "Sleeps 3-4 hours at a time",
      "allergies": ["dairy", "nuts"],
      "medications": [
        {
          "name": "Vitamin D drops",
          "dosage": "1 drop",
          "frequency": "daily"
        }
      ],
      "createdAt": "2025-06-07T04:00:00.000Z",
      "updatedAt": "2025-06-07T04:00:00.000Z"
    }
  }
}
```

#### Error Responses
- **400 Bad Request**: Invalid baby ID format
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Account deactivated
- **404 Not Found**: Baby profile not found or access denied

---

### 4. Update Baby Profile
**PUT** `/api/babies/:id`

Updates a baby profile. User must own the baby profile. Supports partial updates.

#### Headers
- `Authorization: Bearer <jwt_token>` (required)
- `Content-Type: application/json`

#### URL Parameters
- `id` (string, required): Baby profile ID

#### Request Body
All fields are optional for updates:
```json
{
  "name": "Emma Rose Johnson",
  "weight": {
    "current": 4800
  },
  "feedingNotes": "Now eating some solid foods"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Baby profile updated successfully",
  "timestamp": "2025-06-07T04:00:00.000Z",
  "data": {
    "baby": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "Emma Rose Johnson",
      "birthDate": "2024-01-15T00:00:00.000Z",
      "gender": "female",
      "weight": {
        "birth": 3200,
        "current": 4800
      },
      "feedingNotes": "Now eating some solid foods",
      "updatedAt": "2025-06-07T04:05:00.000Z"
    }
  }
}
```

#### Error Responses
- **400 Bad Request**: Validation errors or invalid baby ID
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Account deactivated
- **404 Not Found**: Baby profile not found or access denied

---

### 5. Delete Baby Profile
**DELETE** `/api/babies/:id`

Soft deletes a baby profile. User must own the baby profile.

#### Headers
- `Authorization: Bearer <jwt_token>` (required)

#### URL Parameters
- `id` (string, required): Baby profile ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Baby profile deleted successfully",
  "timestamp": "2025-06-07T04:00:00.000Z",
  "data": {
    "deletedBabyId": "60f7b3b3b3b3b3b3b3b3b3b3"
  }
}
```

#### Error Responses
- **400 Bad Request**: Invalid baby ID format
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Account deactivated
- **404 Not Found**: Baby profile not found or access denied

---

### 6. Upload Baby Photo
**POST** `/api/babies/:id/upload-photo`

Uploads and processes a photo for a baby profile. User must own the baby profile.

#### Headers
- `Authorization: Bearer <jwt_token>` (required)
- `Content-Type: multipart/form-data`

#### URL Parameters
- `id` (string, required): Baby profile ID

#### Form Data
- `photo` (file, required): Image file (JPEG, PNG, WebP, max 5MB)

#### Success Response (200)
```json
{
  "success": true,
  "message": "Baby photo uploaded and processed successfully",
  "timestamp": "2025-06-07T04:00:00.000Z",
  "data": {
    "baby": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "Emma Johnson",
      "profilePicture": {
        "thumbnail": "/uploads/baby-photos/baby-60f7b3b3-1625097600000-thumb.webp",
        "medium": "/uploads/baby-photos/baby-60f7b3b3-1625097600000-medium.webp",
        "original": "/uploads/baby-photos/baby-60f7b3b3-1625097600000-original.webp"
      },
      "photoProcessing": {
        "sizes": {
          "thumbnail": "150x150",
          "medium": "400x400",
          "original": "800x600"
        },
        "message": "Photo processed successfully"
      }
    }
  }
}
```

#### Error Responses
- **400 Bad Request**: No file uploaded, invalid file type, file too large, or invalid baby ID
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Account deactivated
- **404 Not Found**: Baby profile not found or access denied

---

### 7. Delete Baby Photo
**DELETE** `/api/babies/:id/photo`

Deletes the photo from a baby profile. User must own the baby profile.

#### Headers
- `Authorization: Bearer <jwt_token>` (required)

#### URL Parameters
- `id` (string, required): Baby profile ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Baby photo deleted successfully",
  "timestamp": "2025-06-07T04:00:00.000Z",
  "data": {
    "baby": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "name": "Emma Johnson",
      "profilePicture": {
        "thumbnail": null,
        "medium": null,
        "original": null
      }
    }
  }
}
```

#### Error Responses
- **400 Bad Request**: Invalid baby ID format
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Account deactivated
- **404 Not Found**: Baby profile not found, access denied, or no photo found

---

## Error Response Format

All error responses follow this standardized format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE",
  "timestamp": "2025-06-07T04:00:00.000Z",
  "field": "fieldName",
  "errors": [
    {
      "field": "name",
      "message": "Baby name must be between 1 and 50 characters",
      "value": "",
      "location": "body"
    }
  ]
}
```

## Common Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_REQUIRED`: Missing or invalid JWT token
- `ACCOUNT_DEACTIVATED`: User account is deactivated
- `BABY_NOT_FOUND`: Baby profile not found or access denied
- `INVALID_BABY_ID`: Invalid baby ID format
- `NO_FILE_UPLOADED`: No photo file provided
- `FILE_TOO_LARGE`: File exceeds 5MB limit
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Rate Limits

- **Profile Updates**: 10 requests per 15 minutes per IP
- **Profile Reads**: 100 requests per 15 minutes per IP
- **Photo Uploads**: 10 requests per 15 minutes per IP

## Security Features

- JWT-based authentication required for all endpoints
- User ownership validation (users can only access their own baby profiles)
- Input sanitization and validation
- Rate limiting to prevent abuse
- Secure file upload with type and size validation
- Comprehensive error logging
- CORS protection
- Helmet security headers 