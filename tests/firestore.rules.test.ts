import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let env: RulesTestEnvironment;

const people = {
  dosen: { uid: "dosen", name: "Bu Dosen", email: "dosen@example.com" },
  ani: { uid: "ani", name: "Ani", email: "ani@example.com" },
  budi: { uid: "budi", name: "Budi", email: "budi@example.com" },
  luar: { uid: "luar", name: "Orang Luar", email: "luar@example.com" },
};
type Person = (typeof people)[keyof typeof people];

const CID = "c1";
const CODE = "ABC234";

function dbFor(p: Person): Firestore {
  return env
    .authenticatedContext(p.uid, { name: p.name, email: p.email, email_verified: true })
    .firestore() as unknown as Firestore;
}

function createCourse(db: Firestore, p: Person, code = CODE) {
  const b = writeBatch(db);
  b.set(doc(db, "courses", CID), {
    name: "Struktur Data A",
    code,
    topics: ["Rekursi"],
    lecturerUid: p.uid,
    lecturerName: p.name,
    createdAt: serverTimestamp(),
  });
  b.set(doc(db, "joinCodes", code), { courseId: CID, courseName: "Struktur Data A" });
  b.set(doc(db, "courses", CID, "members", p.uid), {
    uid: p.uid,
    courseId: CID,
    name: p.name,
    email: p.email,
    role: "lecturer",
    courseName: "Struktur Data A",
    joinCode: code,
    joinedAt: serverTimestamp(),
  });
  return b.commit();
}

function join(db: Firestore, p: Person, code = CODE, role = "student") {
  return setDoc(doc(db, "courses", CID, "members", p.uid), {
    uid: p.uid,
    courseId: CID,
    name: p.name,
    email: p.email,
    role,
    courseName: "Struktur Data A",
    joinCode: code,
    joinedAt: serverTimestamp(),
  });
}

function ask(db: Firestore, p: Person, qid: string, extra: Record<string, unknown> = {}) {
  const b = writeBatch(db);
  b.set(doc(db, "courses", CID, "questions", qid), {
    title: "Kenapa rekursi butuh base case?",
    body: "",
    topic: "Rekursi",
    status: "open",
    answerCount: 0,
    verifiedAnswerId: null,
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    ...extra,
  });
  b.set(doc(db, "courses", CID, "questionAuthors", qid), {
    uid: p.uid,
    name: p.name,
    email: p.email,
    createdAt: serverTimestamp(),
  });
  return b.commit();
}

function answer(
  db: Firestore,
  p: Person,
  role: string,
  qid: string,
  aid: string,
  opts: { official?: boolean; status?: string } = {},
) {
  const official = opts.official ?? false;
  const b = writeBatch(db);
  b.set(doc(db, "courses", CID, "questions", qid, "answers", aid), {
    body: "Supaya berhenti.",
    authorUid: p.uid,
    authorName: p.name,
    authorRole: role,
    official,
    verified: official,
    verifiedAt: official ? serverTimestamp() : null,
    createdAt: serverTimestamp(),
  });
  b.update(doc(db, "courses", CID, "questions", qid), {
    answerCount: increment(1),
    status: official ? "verified" : (opts.status ?? "answered"),
    ...(official ? { verifiedAnswerId: aid } : {}),
    lastActivityAt: serverTimestamp(),
  });
  return b.commit();
}

function verify(db: Firestore, qid: string, aid: string) {
  const b = writeBatch(db);
  b.update(doc(db, "courses", CID, "questions", qid, "answers", aid), { verified: true, verifiedAt: serverTimestamp() });
  b.update(doc(db, "courses", CID, "questions", qid), {
    status: "verified",
    verifiedAnswerId: aid,
    lastActivityAt: serverTimestamp(),
  });
  return b.commit();
}

/** Takes the verification back: the lecturer's undo, or (with a new body) an author's edit. */
function unverify(db: Firestore, qid: string, aid: string, answerChanges: Record<string, unknown> = {}) {
  const b = writeBatch(db);
  b.update(doc(db, "courses", CID, "questions", qid, "answers", aid), {
    verified: false,
    verifiedAt: null,
    ...answerChanges,
  });
  b.update(doc(db, "courses", CID, "questions", qid), {
    status: "answered",
    verifiedAnswerId: null,
    lastActivityAt: serverTimestamp(),
  });
  return b.commit();
}

function removeAnswer(db: Firestore, qid: string, aid: string, questionChanges: Record<string, unknown>) {
  const b = writeBatch(db);
  b.delete(doc(db, "courses", CID, "questions", qid, "answers", aid));
  b.update(doc(db, "courses", CID, "questions", qid), {
    answerCount: increment(-1),
    lastActivityAt: serverTimestamp(),
    ...questionChanges,
  });
  return b.commit();
}

beforeAll(async () => {
  // emulators:exec sets FIRESTORE_EMULATOR_HOST; 8080 is the port in firebase.json.
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-learning-loop",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore() as unknown as Firestore, "lecturers", people.dosen.email), { name: people.dosen.name }),
  );
  await createCourse(dbFor(people.dosen), people.dosen);
  await join(dbFor(people.ani), people.ani);
  await join(dbFor(people.budi), people.budi);
});

describe("courses and membership", () => {
  it("lets only approved lecturers create a course", async () => {
    await env.clearFirestore();
    await assertFails(createCourse(dbFor(people.luar), people.luar, "QWE234"));
    await assertFails(createCourse(dbFor(people.dosen), people.dosen, "QWE234"));
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore() as unknown as Firestore, "lecturers", people.dosen.email), {}),
    );
    await assertSucceeds(createCourse(dbFor(people.dosen), people.dosen, "QWE234"));
  });

  it("does not let users add themselves to the lecturer list", async () => {
    await assertFails(setDoc(doc(dbFor(people.luar), "lecturers", people.luar.email), {}));
    await assertFails(getDocs(collection(dbFor(people.luar), "lecturers")));
    await assertSucceeds(getDoc(doc(dbFor(people.luar), "lecturers", people.luar.email)));
    await assertFails(getDoc(doc(dbFor(people.luar), "lecturers", people.dosen.email)));
  });

  it("lets a student join only with the right code", async () => {
    await assertFails(join(dbFor(people.luar), people.luar, "ZZZ999"));
    await assertSucceeds(join(dbFor(people.luar), people.luar));
  });

  it("does not let a student join as lecturer or mentor", async () => {
    await assertFails(join(dbFor(people.luar), people.luar, CODE, "lecturer"));
    await assertFails(join(dbFor(people.luar), people.luar, CODE, "mentor"));
  });

  it("keeps courses and questions away from non-members", async () => {
    await ask(dbFor(people.ani), people.ani, "q1");
    const luar = dbFor(people.luar);
    await assertFails(getDoc(doc(luar, "courses", CID)));
    await assertFails(getDocs(collection(luar, "courses", CID, "questions")));
  });

  it("never lets join codes be listed", async () => {
    await assertFails(getDocs(collection(dbFor(people.luar), "joinCodes")));
    await assertSucceeds(getDoc(doc(dbFor(people.luar), "joinCodes", CODE)));
  });

  it("lets only the lecturer promote a peer mentor", async () => {
    await assertFails(updateDoc(doc(dbFor(people.ani), "courses", CID, "members", "ani"), { role: "mentor" }));
    await assertFails(updateDoc(doc(dbFor(people.ani), "courses", CID, "members", "budi"), { role: "mentor" }));
    await assertSucceeds(updateDoc(doc(dbFor(people.dosen), "courses", CID, "members", "ani"), { role: "mentor" }));
    await assertFails(updateDoc(doc(dbFor(people.dosen), "courses", CID, "members", "ani"), { role: "lecturer" }));
  });

  it("finds a user's own memberships across courses", async () => {
    const ani = dbFor(people.ani);
    const snap = await assertSucceeds(getDocs(query(collectionGroup(ani, "members"), where("uid", "==", "ani"))));
    expect(snap.docs.map((d) => d.data().courseId)).toEqual([CID]);
    await assertFails(getDocs(query(collectionGroup(ani, "members"), where("uid", "==", "budi"))));
  });

  it("hides the member list from students", async () => {
    await assertFails(getDocs(collection(dbFor(people.ani), "courses", CID, "members")));
    await assertSucceeds(getDocs(collection(dbFor(people.dosen), "courses", CID, "members")));
  });
});

describe("anonymous questions", () => {
  it("hides the asker from classmates but not from the lecturer or the asker", async () => {
    await assertSucceeds(ask(dbFor(people.ani), people.ani, "q1"));
    const authorDoc = (p: Person) => getDoc(doc(dbFor(p), "courses", CID, "questionAuthors", "q1"));
    await assertFails(authorDoc(people.budi));
    await assertSucceeds(authorDoc(people.ani));
    const seen = await assertSucceeds(authorDoc(people.dosen));
    expect(seen.data()?.uid).toBe("ani");
    await assertFails(getDocs(collection(dbFor(people.budi), "courses", CID, "questionAuthors")));
    await assertSucceeds(
      getDocs(query(collection(dbFor(people.ani), "courses", CID, "questionAuthors"), where("uid", "==", "ani"))),
    );
  });

  it("rejects a question that carries the author's identity", async () => {
    await assertFails(ask(dbFor(people.ani), people.ani, "q1", { authorUid: "ani" }));
  });

  it("accepts a title of up to 300 characters and rejects a longer one", async () => {
    await assertSucceeds(ask(dbFor(people.ani), people.ani, "q1", { title: "a".repeat(300) }));
    await assertFails(ask(dbFor(people.ani), people.ani, "q2", { title: "a".repeat(301) }));
  });

  it("rejects a question without an author record", async () => {
    await assertFails(
      setDoc(doc(dbFor(people.ani), "courses", CID, "questions", "q1"), {
        title: "Pertanyaan tanpa penulis",
        body: "",
        topic: "Rekursi",
        status: "open",
        answerCount: 0,
        verifiedAnswerId: null,
        createdAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
      }),
    );
  });

  it("does not let anyone claim an existing question", async () => {
    await ask(dbFor(people.ani), people.ani, "q1");
    await assertFails(
      setDoc(doc(dbFor(people.budi), "courses", CID, "questionAuthors", "q1"), {
        uid: "budi",
        name: "Budi",
        email: "budi@example.com",
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("does not let a student write an author record for someone else", async () => {
    const db = dbFor(people.budi);
    const b = writeBatch(db);
    b.set(doc(db, "courses", CID, "questions", "q2"), {
      title: "Pertanyaan atas nama orang lain",
      body: "",
      topic: "Rekursi",
      status: "open",
      answerCount: 0,
      verifiedAnswerId: null,
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });
    b.set(doc(db, "courses", CID, "questionAuthors", "q2"), {
      uid: "ani",
      name: "Ani",
      email: "ani@example.com",
      createdAt: serverTimestamp(),
    });
    await assertFails(b.commit());
  });
});

describe("answers and verification", () => {
  beforeEach(() => ask(dbFor(people.ani), people.ani, "q1"));

  it("lets a classmate answer and bump the counter", async () => {
    await assertSucceeds(answer(dbFor(people.budi), people.budi, "student", "q1", "a1"));
  });

  it("rejects an answer under someone else's name or role", async () => {
    await assertFails(answer(dbFor(people.budi), people.ani, "student", "q1", "a1"));
    await assertFails(answer(dbFor(people.budi), people.budi, "mentor", "q1", "a1"));
  });

  it("rejects an answer that does not bump the counter", async () => {
    await assertFails(
      setDoc(doc(dbFor(people.budi), "courses", CID, "questions", "q1", "answers", "a1"), {
        body: "x",
        authorUid: "budi",
        authorName: "Budi",
        authorRole: "student",
        official: false,
        verified: false,
        verifiedAt: null,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it("does not let a student post an official answer or verify", async () => {
    await assertFails(answer(dbFor(people.budi), people.budi, "student", "q1", "a1", { official: true }));
    await answer(dbFor(people.budi), people.budi, "student", "q1", "a1");
    const db = dbFor(people.budi);
    const b = writeBatch(db);
    b.update(doc(db, "courses", CID, "questions", "q1", "answers", "a1"), { verified: true, verifiedAt: serverTimestamp() });
    b.update(doc(db, "courses", CID, "questions", "q1"), {
      status: "verified",
      verifiedAnswerId: "a1",
      lastActivityAt: serverTimestamp(),
    });
    await assertFails(b.commit());
  });

  it("lets the lecturer verify a peer answer", async () => {
    await answer(dbFor(people.budi), people.budi, "student", "q1", "a1");
    const db = dbFor(people.dosen);
    const b = writeBatch(db);
    b.update(doc(db, "courses", CID, "questions", "q1", "answers", "a1"), { verified: true, verifiedAt: serverTimestamp() });
    b.update(doc(db, "courses", CID, "questions", "q1"), {
      status: "verified",
      verifiedAnswerId: "a1",
      lastActivityAt: serverTimestamp(),
    });
    await assertSucceeds(b.commit());
  });

  it("lets the lecturer post an official answer", async () => {
    await assertSucceeds(answer(dbFor(people.dosen), people.dosen, "lecturer", "q1", "a1", { official: true }));
  });

  it("does not let the lecturer mark a question verified without a verified answer", async () => {
    await answer(dbFor(people.budi), people.budi, "student", "q1", "a1");
    await assertFails(
      updateDoc(doc(dbFor(people.dosen), "courses", CID, "questions", "q1"), {
        status: "verified",
        verifiedAnswerId: "a1",
        lastActivityAt: serverTimestamp(),
      }),
    );
  });
});

describe("undoing verification, editing and deleting answers", () => {
  beforeEach(async () => {
    await ask(dbFor(people.ani), people.ani, "q1");
    await answer(dbFor(people.budi), people.budi, "student", "q1", "a1");
  });

  const answerDoc = (p: Person) => doc(dbFor(p), "courses", CID, "questions", "q1", "answers", "a1");

  it("lets the lecturer undo a verification, but not a classmate", async () => {
    await verify(dbFor(people.dosen), "q1", "a1");
    await assertFails(unverify(dbFor(people.ani), "q1", "a1"));
    await assertSucceeds(unverify(dbFor(people.dosen), "q1", "a1"));
  });

  it("does not let the question drop its verification while the answer stays verified", async () => {
    await verify(dbFor(people.dosen), "q1", "a1");
    await assertFails(
      updateDoc(doc(dbFor(people.dosen), "courses", CID, "questions", "q1"), {
        status: "answered",
        verifiedAnswerId: null,
        lastActivityAt: serverTimestamp(),
      }),
    );
  });

  it("lets only the author edit an answer", async () => {
    await assertFails(updateDoc(answerDoc(people.ani), { body: "Diubah orang lain." }));
    await assertFails(updateDoc(answerDoc(people.dosen), { body: "Diubah dosen." }));
    await assertFails(updateDoc(answerDoc(people.budi), { body: "" }));
    await assertSucceeds(updateDoc(answerDoc(people.budi), { body: "Diperbaiki." }));
  });

  it("drops the verification when a student edits a verified answer", async () => {
    await verify(dbFor(people.dosen), "q1", "a1");
    await assertFails(updateDoc(answerDoc(people.budi), { body: "Diam-diam diganti." }));
    await assertSucceeds(unverify(dbFor(people.budi), "q1", "a1", { body: "Diperbaiki." }));
  });

  it("keeps an official answer verified when the lecturer edits it", async () => {
    await answer(dbFor(people.dosen), people.dosen, "lecturer", "q1", "a2", { official: true });
    await assertSucceeds(
      updateDoc(doc(dbFor(people.dosen), "courses", CID, "questions", "q1", "answers", "a2"), { body: "Koreksi." }),
    );
  });

  it("lets the author or the lecturer delete an answer, together with lowering the counter", async () => {
    await answer(dbFor(people.budi), people.budi, "student", "q1", "a2");
    await assertFails(removeAnswer(dbFor(people.ani), "q1", "a1", {}));
    await assertFails(deleteDoc(answerDoc(people.budi)));
    await assertFails(deleteDoc(answerDoc(people.dosen)));
    await assertSucceeds(removeAnswer(dbFor(people.budi), "q1", "a2", {}));
    await assertSucceeds(removeAnswer(dbFor(people.dosen), "q1", "a1", { status: "open" }));
  });

  it("clears the verification when the verified answer is deleted", async () => {
    await verify(dbFor(people.dosen), "q1", "a1");
    await assertFails(removeAnswer(dbFor(people.budi), "q1", "a1", { status: "open" }));
    await assertSucceeds(removeAnswer(dbFor(people.budi), "q1", "a1", { status: "open", verifiedAnswerId: null }));
  });
});
