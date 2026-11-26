# Learning Loop

Per-course Q&A for university classes: students ask questions that are
**anonymous to classmates but visible to the lecturer**, classmates and peer
mentors answer, and the lecturer verifies the correct answer or writes an
official one. Built by team Trio Pejabat for STACK 2026 (GDGoC ITB), Case 1:
Smarter Campus and Learning. The user interface is in Indonesian.

Live: https://learning-loop2.vercel.app

## Status (26 November 2026)

| Feature | Status |
|---|---|
| Google Sign-In | Done |
| Approved lecturer creates a course and gets a 6-character join code | Done |
| Every other account is a student; nobody can choose the lecturer role | Done |
| Student joins with the code | Done |
| Anonymous question (asker hidden from classmates, visible to lecturer) | Done |
| Classmates and peer mentors answer | Done |
| Lecturer verifies a peer answer or posts an official answer | Done |
| Lecturer undoes a verification | Done |
| Authors edit and delete their own answers (a student's or mentor's edit removes the verification) | Done |
| Lecturer deletes any answer in the course | Done |
| Lecturer promotes students to peer mentor | Done |
| Filter questions by status and topic; "my questions" | Done |
| Deployment (Vercel + Firebase project) | Done |
| Weekly topic summary for the lecturer (last 7 days by topic: a one-line headline, then unanswered, unverified, verified) | Done |
| Similar-question matching (TF-IDF) | **Not started** (Final Day task) |
| Lecturer moderation (remove off-topic questions) | **Not started** (Final Day task) |
| Notifications | **Not started** (lower priority) |
| Test sessions with real students and a lecturer | **Not started** (planned 5-12 Dec) |

The demo course (`npm run seed`, local emulator only) is **synthetic** and
shown with a "Data demo" label. It does not come from real students or from
the team's survey.

## How anonymity is enforced

A question document stores no author. The asker is stored separately in
`courses/{courseId}/questionAuthors/{questionId}`, which Firestore security
rules let only the asker and the course lecturer read. Classmates therefore
cannot find the asker even with browser developer tools. Answers show the
answerer's name. See `firestore.rules` and `tests/firestore.rules.test.ts`.

## Approving lecturers

Only lecturers the team has approved can create courses. In the Firebase
console, open Firestore, create (once) a collection named `lecturers`, and add
one document per lecturer whose **Document ID is their Google email in lower
case** (fields are optional, e.g. `name`). The security rules check this list;
users cannot read it or add themselves. Everyone else signs in as a student
and joins a course with its code.

## Tech stack

Next.js 16 (App Router, client-side data), React 19, Tailwind CSS 4,
Firebase Authentication (Google), Cloud Firestore. No generative AI answers
questions.

## Running locally

Requirements: Node.js 22 or newer, and **Java 21 or newer** (the Firebase
Emulator needs it).

```bash
npm install
cp .env.example .env.local      # emulator mode, no Firebase project needed
npm run emulators               # terminal 1: Auth + Firestore emulators, UI at http://127.0.0.1:4000
npm run dev                     # terminal 2: app at http://localhost:3000
npm run seed                    # terminal 3: synthetic demo course, join code DEMO26
```

In emulator mode, "Masuk dengan Google" opens a fake sign-in window where you
can add any test account. To make your test account the demo course's
lecturer, sign in once and run `npm run seed -- --lecturer <that email>`.

Emulator data is wiped when the emulators stop; run `npm run seed` again.

## Tests

```bash
npm run test:rules   # 29 security-rule tests + 5 summary unit tests (starts its own Firestore emulator)
npm run test:unit    # only the weekly-summary unit tests, no emulator needed
npm run smoke        # end-to-end run of src/lib/data.ts; needs `npm run emulators` running
```

## Known limitations

- Lecturer approval is manual (the team adds emails in the Firebase console).
- A course name cannot be changed after creation.
- A member could raise or lower a question's answer counter without posting or
  deleting an answer. This changes the displayed count and status label (a
  count of 0 shows the question as unanswered), and while the count is 0 the
  remaining answers cannot be deleted until someone posts a new one.
- Lecturers can delete any answer but edit only their own.
- Not yet tested with real students or lecturers.
- Light theme only.

## Third-party resources

Next.js, React, Tailwind CSS, the Firebase JavaScript SDK, Firebase Admin SDK,
Firebase CLI and Emulator Suite, Vitest, tsx, and the Geist font (Google
Fonts). Project scaffolded with `create-next-app`. Services: Vercel (hosting),
Firebase Authentication and Cloud Firestore, and Google Forms and Google Sheets
(team surveys and charts).

## AI assistance disclosure

Claude (Anthropic) was used through Claude Code to write most of the initial
code in this repository (data model, Firestore security rules, pages, tests,
seed script) and this README, under the team's direction. The team reviews,
tests, and is responsible for the code.

## Team

| Member | Role | Contributions so far |
|---|---|---|
| Vincent Joe Wangsadidjaja (Team Leader) | Research, validation, and communication | Designed and distributed the surveys with Steven; co-wrote the abstract and made the survey charts with the team |
| Steven Wijaya | Technical lead: backend, security, deployment | Designed and distributed the surveys with Vincent; co-wrote the abstract and charts; directed the app's development; deployed it to Vercel and Firebase; reviewed code with Jonathan |
| Jonathan Hartanto | Product and frontend; matching and metrics | Co-wrote the abstract and charts; tested the app's flows; reviewed code with Steven |
