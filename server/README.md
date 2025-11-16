# AI Interview Platform - Backend API

Intelligent interview management system with AI-powered evaluation using Google Gemini.

## Features

- JWT-based authentication system
- AI-powered interview evaluation with Gemini 2.0 Flash
- Email notifications with interview links
- Real-time interview status tracking
- Tab violation monitoring
- Comprehensive result storage

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **AI**: Google Gemini 2.0 Flash API
- **Email**: Nodemailer
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcrypt, cookie-parser, CORS

## Prerequisites

Before running the application, ensure you have:

- Node.js v18 or higher
- MongoDB instance (local or cloud)
- Google Gemini API key
- SMTP email credentials (Gmail recommended)

## Installation

1. **Clone the repository**
git clone <repository-url>
cd server

2. **Install dependencies**
npm install

3. **Configure environment variables**

Create a `.env` file in the `server` directory:
Server Configuration
PORT=4000
NODE_ENV=development

Database
MONGODB_URI=mongodb://localhost:27017/ai-interview

JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this

Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

Frontend URL
FRONTEND_URL=http://localhost:3000

4. **Start MongoDB**

If using local MongoDB:
Or use MongoDB Atlas cloud service.

## Running the Application

### Development Mode

npm run dev
### Production Mode

npm start


