# Case Western Reserve University Weatherhead School of Management AI Avatar Kiosk Project

This is the codebase for the Case Western Reserve University Weatherhead School of Management AI Avatar Kiosk Project, built using Next.js 16 (app directory) and HeroUI (v2)

## Technologies Used

- [Next.js 16](https://nextjs.org/docs/getting-started)
- [HeroUI v2](https://heroui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- JWT Authentication with dual login methods
- CWRU Single Sign-On (SSO) integration

## How to Use

### Install dependencies

You can use one of them `npm`, `yarn`, `pnpm`, `bun`, Example using `npm`:

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

### Build the application

```bash
npm run build
```

### Run the production server

```bash
npm run start
```

## Authentication

The application supports two authentication methods:

### 1. Email/Password Authentication

For testing purposes, you can use these credentials:

- **Admin**: admin@example.com / admin123
- **User**: user@example.com / user123

### 2. CWRU Single Sign-On (SSO)

The application integrates with Case Western Reserve University's SSO system using the CAS (Central Authentication Service) protocol.

#### How CWRU SSO Works:

1. User clicks "Sign in with CWRU SSO" on the login page
2. User is redirected to `https://login.case.edu/cas/login`
3. User authenticates with their CWRU credentials
4. CWRU redirects back to the application with a CAS ticket
5. The application validates the ticket with CWRU's CAS server
6. Upon successful validation, user information is extracted and a JWT token is created
7. User is logged in and redirected to the main application

#### CWRU SSO Features:

- Automatic user creation for new CWRU users
- User information synchronization (name, email, student ID)
- Secure token-based session management
- Seamless integration with existing JWT authentication system

The SSO callback endpoint is available at `/api/auth/cwru-sso-callback` and handles the CAS ticket validation process.

### JWT

Generate a new JWT with this command

```bash
openssl rand -base64 48
```
