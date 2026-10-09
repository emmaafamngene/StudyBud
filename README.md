# StudyBud

StudyBud is a Next.js app for turning lecture materials into learning experiences.
The first vertical slice uploads text-based PDFs, extracts their text on the server,
and saves them to Supabase for the document library.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `SUPABASE_URL` and
   `SUPABASE_SECRET_KEY`. The secret key is only read by server-side code; never
   use a `NEXT_PUBLIC_` prefix for it.
3. Create a Google AI Studio API key and set `GEMINI_API_KEY` in `.env.local`.
   This key is only used by the server and must not use a `NEXT_PUBLIC_` prefix.
4. Apply `supabase/migrations/20261008180000_create_documents.sql` to your Supabase
   project. This creates the `documents` table and a private `documents` Storage bucket.
   Apply `supabase/migrations/20261009065000_add_document_library_metadata.sql` to enable
   document subjects and file sizes in the library. Apply
   `supabase/migrations/20261009110000_create_quiz_rush_sessions.sql` to enable
   server-scored Quiz Rush sessions.
5. Start the app with `npm run dev`.

## Deploying to Vercel

Import the GitHub repository into Vercel and set these server-only environment
variables for Production (and Preview if needed): `SUPABASE_URL`,
`SUPABASE_SECRET_KEY`, and `GEMINI_API_KEY`. Do not add the secret key or Gemini key
with a `NEXT_PUBLIC_` prefix. Apply all Supabase migrations in order before using
uploads, document metadata, or Quiz Rush. Then deploy the `main` branch.

Gemini-backed routes set a 60-second maximum function duration for Vercel deployments.
The Gemini API key, Supabase secret, and uploaded PDF contents are used only by
server-side routes.

The upload endpoint accepts PDF files up to 20 MB. Scanned/image-only PDFs are not
supported because this slice does not include OCR. PDFs upload directly to Supabase
Storage using a short-lived, server-generated signed URL; the server then downloads
the object, extracts its text, and inserts its metadata and text into the database.

The study page's chat route loads the selected document's extracted text from
Supabase on the server and sends it to Google AI (`gemini-3.1-flash-lite`) as context.
The document text and Gemini key are not sent to the browser by the chat request.

The app includes Home, My Documents, Settings, and a document study workspace. Quiz
results are saved in the current browser's local storage and power the Home dashboard's
quiz count, average score, and seven-day quiz activity. This history is device-local
until authentication and account-based syncing are added. Study duration and streaks
are not currently tracked.

StudyBud Arena's Quiz Rush generates up to ten questions from a selected document and
uses a shorter round when the notes support fewer distinct questions. The server stores
the answer key and session progress in the private `quiz_rush_sessions` table,
checks answers sequentially, and prevents a question or completed session from awarding
points more than once. Sessions expire after one hour. Arena XP is stored locally in the
browser because the app does not have student accounts, so it is not synced and is not
authoritative progression data.

Quiz Rush first uses extracted PDF text. If that text is missing or too sparse to create
a useful round, it sends the original PDF to Gemini for PDF-native reading, which can
interpret scanned pages as well as selectable text. This uses the existing 20 MB PDF
upload limit and Gemini API key; the source file is fetched and sent only by server-side
code. The Quiz Rush migration must be applied before starting a game.
