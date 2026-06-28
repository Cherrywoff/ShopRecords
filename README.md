# ShopRecords - Production Setup & APK Build Guide

ShopRecords is a premium, multi-tenant POS, inventory, udhar, expense, and retail management SaaS system designed for Indian retail shops. It is engineered with an offline-first architecture using local IndexedDB storage, a custom sync engine with exponential backoff & quarantine vault, and a Supabase cloud database syncing backend.

---

## 1. Local Development Setup

To run the application locally on your PC, you will need to install **Node.js** (version 18+).

### Step 1: Install Dependencies
Open your command terminal in this directory and run:
```bash
npm install
```

### Step 2: Configure Environment Parameters
1. Copy the `.env.example` file to create `.env`:
   ```bash
   copy .env.example .env
   ```
2. Open `.env` and fill in your Supabase project credentials:
   - `VITE_SUPABASE_URL`: Your Supabase Project API URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon/Public API Key.
   
*(Note: If these variables are not configured, the application will automatically fallback to run in a standalone sandboxed local-only offline mode for immediate testing).*

### Step 3: Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) inside your web browser.

---

## 2. Cloud Database Setup (Supabase)

1. Create a free account at [Supabase](https://supabase.com/).
2. Create a new project named **ShopRecords**.
3. Once the database is initialized, navigate to the **SQL Editor** in the Supabase Sidebar dashboard.
4. Click **New query**, paste the entire contents of the [database_schema.sql](file:///c:/Users/radhe/Desktop/shoprecords/database_schema.sql) file, and click **Run**.
5. This will automatically set up the multi-tenant shops, profiles, inventories, POS records, daily closing shifts, and audit logs schemas, together with RLS security policies.

---

## 3. Web Hosting Deployment (Netlify)

To host your web app on Netlify with automated continuous integration:

1. Create a free account on [Netlify](https://www.netlify.com/).
2. Push your local `shoprecords` repository to a private **GitHub** repository.
3. On the Netlify Dashboard, click **Add new site** -> **Import from Git**.
4. Authorize and select your `shoprecords` repository.
5. Set the build configurations:
   - **Build Command**: `npm run build`
   - **Publish directory**: `dist`
6. Click **Add Environment Variables** and define:
   - `VITE_SUPABASE_URL` = *(Your Supabase URL)*
   - `VITE_SUPABASE_ANON_KEY` = *(Your Supabase Anon Key)*
7. Click **Deploy site**. Netlify will host and update the app automatically!

---

## 4. Standalone Android APK Compilation (Capacitor)

To compile the React web application into a standalone Android APK (`.apk` file) for manual distribution via WhatsApp or Pen Drive:

### Step 1: Install Android Studio
Download and install [Android Studio](https://developer.android.com/studio) on your Windows PC. During installation, ensure the Android SDK is installed.

### Step 2: Install Capacitor packages
Inside your local project directory terminal, install the Ionic Capacitor dependencies:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Step 3: Initialize Capacitor Config
Run the initialization tool:
```bash
npx cap init ShopRecords com.shoprecords.app --web-dir=dist
```

### Step 4: Build your React App
Compile the production-ready static assets:
```bash
npm run build
```

### Step 5: Add Android Platform
Add the Android build directory target:
```bash
npx cap add android
```

### Step 6: Sync Web Build assets with Android Studio
Copy your compiled code to the native Android container:
```bash
npx cap sync
```

### Step 7: Open in Android Studio & Compile APK
1. Open the Android project in Android Studio:
   ```bash
   npx cap open android
   ```
2. Wait for Android Studio to index your project and run Gradle sync (1-2 minutes).
3. In the top toolbar, go to: **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
4. Android Studio will compile your code and show a popup notification when finished:
   *`Build APK(s): APK(s) generated successfully for module 'app'.`*
5. Click **Locate** in that popup. It will open the folder containing your compiled `.apk` file (usually located at `android/app/build/outputs/apk/debug/app-debug.apk`).
6. Rename this file to `ShopRecords.apk`. 

You can now copy this file onto a Pendrive or share it directly through WhatsApp with shopowners to install manually!
