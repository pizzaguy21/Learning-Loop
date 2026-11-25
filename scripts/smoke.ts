/**
 * End-to-end smoke test of the app's own data functions (src/lib/data.ts)
 * against the running emulators, switching between fake Google accounts.
 *
 *   npm run emulators   (in another terminal)
 *   npm run smoke
 */
process.env.NEXT_PUBLIC_USE_EMULATORS = "true";

import assert from "node:assert/strict";

async function main() {
  const { auth, db } = await import("../src/lib/firebase");
  /* eslint-disable @typescript-eslint/no-require-imports */
  // require(), not import(): src/ is compiled to CommonJS here, and mixing the
  // ESM and CJS builds of the SDK gives two incompatible Firestore copies.
  const { GoogleAuthProvider, signInWithCredential, signOut } = require("firebase/auth") as typeof import("firebase/auth");
  const { getDoc, getDocs, terminate } = require("firebase/firestore") as typeof import("firebase/firestore");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const data = await import("../src/lib/data");

  const run = Date.now().toString(36);
  async function as(name: string) {
    await signOut(auth);
    const email = `${name.toLowerCase()}.${run}@example.com`;
    // The Auth emulator accepts an unsigned JSON "ID token" for Google.
    const token = JSON.stringify({ sub: `${name}-${run}`, email, name, email_verified: true });
    const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(token));
    return user;
  }
  async function memberOf(cid: string, uid: string) {
    const snap = await getDoc(data.memberRef(cid, uid));
    return { id: snap.id, ...snap.data() } as import("../src/lib/data").Member;
  }
  async function question(cid: string, qid: string) {
    const snap = await getDoc(data.questionRef(cid, qid));
    return { id: snap.id, ...snap.data() } as import("../src/lib/data").Question;
  }

  // Approve the lecturer the way the team does in the console (emulator admin access).
  const dosenEmail = `dosen.${run}@example.com`;
  const res = await fetch(
    `http://127.0.0.1:8080/v1/projects/demo-learning-loop/databases/(default)/documents/lecturers/${dosenEmail}`,
    { method: "PATCH", headers: { Authorization: "Bearer owner" }, body: JSON.stringify({ fields: {} }) },
  );
  assert.ok(res.ok, `could not approve lecturer: ${res.status}`);

  const ani0 = await as("Ani");
  await assert.rejects(data.createCourse(ani0, "Kelas Ilegal", []));
  console.log("ok  a student cannot create a course");

  const dosen = await as("Dosen");
  const cid = await data.createCourse(dosen, "Kelas Uji Asap", ["Rekursi"]);
  const code = (await getDoc(data.courseRef(cid))).data()!.code as string;
  console.log("ok  lecturer created course, code", code);

  const ani = await as("Ani");
  await assert.rejects(data.joinCourse(ani, "ZZZZZZ"), data.JoinError);
  assert.equal(await data.joinCourse(ani, code.toLowerCase()), cid);
  const qid = await data.askQuestion(cid, await memberOf(cid, ani.uid), {
    title: "Apa itu base case?",
    body: "",
    topic: "Rekursi",
  });
  const mine = await getDocs(data.myQuestionAuthorsQuery(cid, ani.uid));
  assert.deepEqual(mine.docs.map((d) => d.id), [qid]);
  console.log("ok  student joined with code and asked; sees it as her own");

  const budi = await as("Budi");
  await data.joinCourse(budi, code);
  await assert.rejects(getDoc(data.questionAuthorRef(cid, qid)));
  await data.postAnswer(cid, await question(cid, qid), await memberOf(cid, budi.uid), "Kondisi berhenti.");
  assert.equal((await question(cid, qid)).status, "answered");
  console.log("ok  classmate cannot see the asker; answered");

  await as("Dosen");
  const author = await getDoc(data.questionAuthorRef(cid, qid));
  assert.equal(author.data()!.uid, ani.uid);
  const answers = await getDocs(data.answersQuery(cid, qid));
  await data.verifyAnswer(cid, await question(cid, qid), answers.docs[0].id);
  assert.equal((await question(cid, qid)).verifiedAnswerId, answers.docs[0].id);
  console.log("ok  lecturer sees the asker and verified the peer answer");

  await data.postOfficialAnswer(cid, await question(cid, qid), await memberOf(cid, dosen.uid), "Koreksi resmi.");
  const after = await getDocs(data.answersQuery(cid, qid));
  assert.deepEqual(after.docs.map((d) => [d.data().official, d.data().verified]), [[false, false], [true, true]]);
  console.log("ok  official answer replaced the earlier verification");

  type Answer = import("../src/lib/data").Answer;
  async function answerById(id: string) {
    const d = (await getDocs(data.answersQuery(cid, qid))).docs.find((x) => x.id === id)!;
    return { id: d.id, ...d.data() } as Answer;
  }
  const [peerId, officialId] = after.docs.map((d) => d.id);
  const dosenMember = await memberOf(cid, dosen.uid);
  await data.editAnswer(cid, await question(cid, qid), await answerById(officialId), dosenMember, "Koreksi resmi, diperjelas.");
  assert.equal((await question(cid, qid)).verifiedAnswerId, officialId);
  await data.unverifyAnswer(cid, await question(cid, qid));
  let q = await question(cid, qid);
  assert.deepEqual([q.status, q.verifiedAnswerId], ["answered", null]);
  await data.verifyAnswer(cid, await question(cid, qid), peerId);
  console.log("ok  lecturer edited the official answer, undid its verification, verified the peer answer");

  await as("Budi");
  const budiMember = await memberOf(cid, budi.uid);
  await data.editAnswer(cid, await question(cid, qid), await answerById(peerId), budiMember, "Kondisi berhenti, diperbaiki.");
  q = await question(cid, qid);
  assert.deepEqual([q.status, q.verifiedAnswerId], ["answered", null]);
  assert.equal((await answerById(peerId)).verified, false);
  await data.deleteAnswer(cid, await question(cid, qid), peerId);
  assert.equal((await question(cid, qid)).answerCount, 1);
  await data.postAnswer(cid, await question(cid, qid), budiMember, "Jawaban kedua.");
  console.log("ok  student's edit dropped the verification; student deleted their answer and answered again");

  await as("Dosen");
  const secondId = (await getDocs(data.answersQuery(cid, qid))).docs.find((d) => d.data().authorUid === budi.uid)!.id;
  await data.deleteAnswer(cid, await question(cid, qid), secondId);
  await data.deleteAnswer(cid, await question(cid, qid), officialId);
  q = await question(cid, qid);
  assert.deepEqual([q.status, q.answerCount], ["open", 0]);
  console.log("ok  lecturer deleted the student's answer and the official answer; question is open again");

  await data.setMemberRole(cid, budi.uid, "mentor");
  const members = await getDocs(data.membersQuery(cid));
  assert.equal(members.size, 3);
  console.log("ok  lecturer promoted a peer mentor");

  await terminate(db);
  await signOut(auth);
  console.log("SMOKE TEST PASSED");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("SMOKE TEST FAILED", err);
    process.exit(1);
  },
);
