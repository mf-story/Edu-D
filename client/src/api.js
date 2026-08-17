// =====================================================================
// api.js — Pembungkus fetch untuk memanggil API Edu-D.
// Menyisipkan token Bearer secara otomatis dari localStorage.
// =====================================================================

const TOKEN_KEY = "edud_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, isForm } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !isForm) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg = (data && data.error) || `Gagal (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  // Auth
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: { username, password } }),
  me: () => request("/auth/me"),
  updateMe: (data) => request("/auth/me", { method: "PUT", body: data }),
  updateMeForm: (formData) =>
    request("/auth/me", { method: "PUT", body: formData, isForm: true }),
  heartbeat: () => request("/auth/heartbeat", { method: "POST" }),

  // Statistik (dasbor admin)
  stats: () => request("/stats"),

  // Users (admin)
  listUsers: (role) => request(`/users${role ? `?role=${role}` : ""}`),
  createUser: (u) => request("/users", { method: "POST", body: u }),
  createUserForm: (formData) =>
    request("/users", { method: "POST", body: formData, isForm: true }),
  updateUser: (id, u) => request(`/users/${id}`, { method: "PUT", body: u }),
  updateUserForm: (id, formData) =>
    request(`/users/${id}`, { method: "PUT", body: formData, isForm: true }),
  deleteUser: (id) => request(`/users/${id}`, { method: "DELETE" }),
  userTranscript: (id, { academicYearId, semester } = {}) => {
    const qs = new URLSearchParams();
    if (academicYearId) qs.set("academicYearId", academicYearId);
    if (semester) qs.set("semester", semester);
    const q = qs.toString();
    return request(`/users/${id}/transcript${q ? `?${q}` : ""}`);
  },

  // Classes
  listClasses: () => request("/classes"),
  getClass: (id) => request(`/classes/${id}`),
  createClass: (c) => request("/classes", { method: "POST", body: c }),
  updateClass: (id, c) => request(`/classes/${id}`, { method: "PUT", body: c }),
  deleteClass: (id) => request(`/classes/${id}`, { method: "DELETE" }),

  // Pilihan nama kelas
  listClassNameOptions: () => request("/class-name-options"),
  createClassNameOption: (payload) =>
    request("/class-name-options", {
      method: "POST",
      body: typeof payload === "string" ? { name: payload } : payload,
    }),
  updateClassNameOption: (id, patch) =>
    request(`/class-name-options/${id}`, {
      method: "PUT",
      body: typeof patch === "string" ? { name: patch } : patch,
    }),
  deleteClassNameOption: (id) =>
    request(`/class-name-options/${id}`, { method: "DELETE" }),

  // Pilihan nama mata pelajaran (master mapel)
  listSubjectNameOptions: () => request("/subject-name-options"),
  createSubjectNameOption: (name, fase) =>
    request("/subject-name-options", { method: "POST", body: { name, fase } }),
  updateSubjectNameOption: (id, name, fase) =>
    request(`/subject-name-options/${id}`, {
      method: "PUT",
      body: { name, fase },
    }),
  deleteSubjectNameOption: (id) =>
    request(`/subject-name-options/${id}`, { method: "DELETE" }),

  // Katalog kurikulum (SMP: Merdeka / K-13 / KTSP 2006)
  listCurriculumCatalog: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return request(`/curriculum-catalog${qs ? `?${qs}` : ""}`);
  },
  createCurriculumCatalog: (entry) =>
    request("/curriculum-catalog", { method: "POST", body: entry }),
  updateCurriculumCatalog: (id, entry) =>
    request(`/curriculum-catalog/${id}`, { method: "PUT", body: entry }),
  deleteCurriculumCatalog: (id) =>
    request(`/curriculum-catalog/${id}`, { method: "DELETE" }),

  // Master ruangan
  listRooms: () => request("/rooms"),
  createRoom: (room) => request("/rooms", { method: "POST", body: room }),
  updateRoom: (id, patch) =>
    request(`/rooms/${id}`, { method: "PUT", body: patch }),
  deleteRoom: (id) => request(`/rooms/${id}`, { method: "DELETE" }),

  // Tahun akademik
  listAcademicYears: () => request("/academic-years"),
  createAcademicYear: (name, active) =>
    request("/academic-years", { method: "POST", body: { name, active } }),
  updateAcademicYear: (id, patch) =>
    request(`/academic-years/${id}`, { method: "PUT", body: patch }),
  deleteAcademicYear: (id) =>
    request(`/academic-years/${id}`, { method: "DELETE" }),
  getActiveSemester: () => request("/active-semester"),
  setActiveSemester: (semester) =>
    request("/active-semester", { method: "PUT", body: { semester } }),
  getActivePeriod: () => request("/active-period"),
  setActivePeriod: (academicYearId, semester) =>
    request("/active-period", {
      method: "PUT",
      body: { academicYearId, semester },
    }),

  // Subjects (mata pelajaran)
  listSubjects: (classId) =>
    request(`/subjects${classId ? `?classId=${classId}` : ""}`),
  getSubject: (id) => request(`/subjects/${id}`),
  createSubject: (s) => request("/subjects", { method: "POST", body: s }),
  updateSubject: (id, s) => request(`/subjects/${id}`, { method: "PUT", body: s }),
  deleteSubject: (id) => request(`/subjects/${id}`, { method: "DELETE" }),

  // Schedules
  listSchedules: (classId) =>
    request(`/schedules${classId ? `?classId=${classId}` : ""}`),
  createSchedule: (s) => request("/schedules", { method: "POST", body: s }),
  updateSchedule: (id, s) =>
    request(`/schedules/${id}`, { method: "PUT", body: s }),
  deleteSchedule: (id) => request(`/schedules/${id}`, { method: "DELETE" }),

  // Materials
  listMaterials: (subjectId) => request(`/materials?subjectId=${subjectId}`),
  createMaterial: (formData) =>
    request("/materials", { method: "POST", body: formData, isForm: true }),
  updateMaterial: (id, formData) =>
    request(`/materials/${id}`, { method: "PUT", body: formData, isForm: true }),
  // Unggah media (gambar/video/berkas) untuk disisipkan ke konten kaya.
  uploadMedia: (formData) =>
    request("/uploads", { method: "POST", body: formData, isForm: true }),
  deleteMaterial: (id) => request(`/materials/${id}`, { method: "DELETE" }),

  // Curriculum (acuan per pertemuan)
  listCurriculum: (subjectId) =>
    request(`/curriculum?subjectId=${subjectId}`),
  activeCurriculum: (subjectId) =>
    request(`/subjects/${subjectId}/active-curriculum`),
  createCurriculum: (c) => request("/curriculum", { method: "POST", body: c }),
  updateCurriculum: (id, c) =>
    request(`/curriculum/${id}`, { method: "PUT", body: c }),
  deleteCurriculum: (id) =>
    request(`/curriculum/${id}`, { method: "DELETE" }),

  // Pembelajaran (status aktif/nonaktif per nomor pembelajaran)
  listLessonStates: (subjectId) =>
    request(`/lesson-states?subjectId=${subjectId}`),
  setLessonState: (subjectId, pertemuan, active) =>
    request("/lesson-states", {
      method: "PUT",
      body: { subjectId, pertemuan, active },
    }),

  // Tandai materi selesai (oleh pengajar)
  setMaterialCompleted: (id, done) =>
    request(`/materials/${id}/complete`, {
      method: "PUT",
      body: { done },
    }),

  // Siswa menandai "sudah saya pahami" sebuah materi (progres belajar mandiri)
  setMaterialRead: (id, done) =>
    request(`/materials/${id}/read`, {
      method: "PUT",
      body: { done },
    }),

  // Siswa mengirim jawaban kuis mini "Cek Pemahaman" + refleksi
  submitComprehension: (id, { answers, reflection }) =>
    request(`/materials/${id}/comprehension`, {
      method: "PUT",
      body: { answers, reflection },
    }),

  // Aktifkan / nonaktifkan sebuah materi (oleh pengajar)
  setMaterialActive: (id, active) =>
    request(`/materials/${id}/active`, {
      method: "PUT",
      body: { active },
    }),

  // Tampilkan / sembunyikan materi di menu Belajar Mandiri (oleh pengajar)
  setMaterialSelfLearn: (id, selfLearn) =>
    request(`/materials/${id}/self-learn`, {
      method: "PUT",
      body: { selfLearn },
    }),

  // Assignments
  listAssignments: (subjectId) => request(`/assignments?subjectId=${subjectId}`),
  createAssignment: (a) =>
    request("/assignments", { method: "POST", body: a }),
  updateAssignment: (id, a) =>
    request(`/assignments/${id}`, { method: "PUT", body: a }),
  deleteAssignment: (id) => request(`/assignments/${id}`, { method: "DELETE" }),
  // Bagikan / sembunyikan tugas dari siswa (oleh pengajar)
  setAssignmentActive: (id, active) =>
    request(`/assignments/${id}/active`, { method: "PUT", body: { active } }),
  // Tandai tugas selesai (oleh pengajar)
  setAssignmentCompleted: (id, done) =>
    request(`/assignments/${id}/complete`, { method: "PUT", body: { done } }),

  // Submissions
  listSubmissions: (assignmentId) =>
    request(`/submissions?assignmentId=${assignmentId}`),
  submit: (formData) =>
    request("/submissions", { method: "POST", body: formData, isForm: true }),
  grade: (id, grade, feedback) =>
    request(`/submissions/${id}/grade`, {
      method: "PUT",
      body: { grade, feedback },
    }),
  verifyStage: (id, stageId, verified) =>
    request(`/submissions/${id}/stage-verify`, {
      method: "PUT",
      body: { stageId, verified },
    }),

  // Gradebook (rekap nilai)
  gradebook: (subjectId) => request(`/subjects/${subjectId}/gradebook`),
  saveAssessment: (subjectId, body) =>
    request(`/subjects/${subjectId}/assessment`, { method: "PUT", body }),

  // Pantau belajar mandiri siswa (untuk pengajar)
  learningProgress: (subjectId) =>
    request(`/subjects/${subjectId}/learning-progress`),
  // Pengajar menilai pemahaman siswa pada tes pemahaman belajar mandiri
  rateComprehension: (materialId, studentId, rating) =>
    request(`/materials/${materialId}/comprehension-rating`, {
      method: "PUT",
      body: { studentId, rating },
    }),

  // Rapor nilai milik pelajar (lintas kelas & periode)
  myGrades: () => request("/my-grades"),

  // Belajar mandiri: ringkasan progres siswa pada periode aktif.
  // scope="all" menghitung seluruh materi aktif (untuk Beranda), default
  // hanya materi Belajar Mandiri.
  myLearning: (scope) =>
    request(scope ? `/my-learning?scope=${encodeURIComponent(scope)}` : "/my-learning"),

  // Dasbor orang tua (tanpa login) — laporan hasil belajar anak
  parentReport: (name, nisn) =>
    request("/parent/report", { method: "POST", body: { name, nisn } }),

  // Quizzes (kuis pilihan ganda)
  listQuizzes: (subjectId) => request(`/quizzes?subjectId=${subjectId}`),
  getQuiz: (id) => request(`/quizzes/${id}`),
  createQuiz: (q) => request("/quizzes", { method: "POST", body: q }),
  updateQuiz: (id, q) => request(`/quizzes/${id}`, { method: "PUT", body: q }),
  deleteQuiz: (id) => request(`/quizzes/${id}`, { method: "DELETE" }),
  // Bagikan / sembunyikan kuis dari siswa (oleh pengajar)
  setQuizActive: (id, active) =>
    request(`/quizzes/${id}/active`, { method: "PUT", body: { active } }),
  // Tandai kuis selesai (oleh pengajar)
  setQuizCompleted: (id, done) =>
    request(`/quizzes/${id}/complete`, { method: "PUT", body: { done } }),
  submitQuiz: (quizId, answers) =>
    request("/quiz-results", { method: "POST", body: { quizId, answers } }),
  listQuizResults: (quizId) => request(`/quiz-results?quizId=${quizId}`),
  // Pengajar mengizinkan siswa mengerjakan ulang kuis (buka kunci)
  allowQuizRetake: (quizId, studentId) =>
    request(`/quizzes/${quizId}/allow-retake`, {
      method: "POST",
      body: { studentId },
    }),

  // Notifications
  listNotifications: () => request("/notifications"),
  readNotification: (id) =>
    request(`/notifications/${id}/read`, { method: "PUT" }),
  readAllNotifications: () =>
    request("/notifications/read-all", { method: "POST" }),

  // Discussions (forum diskusi per mata pelajaran)
  listDiscussions: (subjectId) => request(`/discussions?subjectId=${subjectId}`),
  postDiscussion: (subjectId, text) =>
    request("/discussions", { method: "POST", body: { subjectId, text } }),
  deleteDiscussion: (id) => request(`/discussions/${id}`, { method: "DELETE" }),

  // Obrolan / Chat (kelas, mapel, & pesan pribadi)
  chatContacts: (subjectId) => request(`/chat/contacts?subjectId=${subjectId}`),
  chatThreads: () => request("/chat/threads"),
  listMessages: ({ scope, classId, subjectId, peerId }) => {
    const qs = new URLSearchParams({ scope });
    if (classId) qs.set("classId", classId);
    if (subjectId) qs.set("subjectId", subjectId);
    if (peerId) qs.set("peerId", peerId);
    return request(`/messages?${qs.toString()}`);
  },
  sendMessage: (payload) =>
    request("/messages", { method: "POST", body: payload }),
  deleteMessage: (id) => request(`/messages/${id}`, { method: "DELETE" }),

  // Comments (komentar pada materi/tugas/kuis)
  listComments: (targetType, targetId) =>
    request(`/comments?targetType=${targetType}&targetId=${targetId}`),
  postComment: (targetType, targetId, text) =>
    request("/comments", {
      method: "POST",
      body: { targetType, targetId, text },
    }),
  deleteComment: (id) => request(`/comments/${id}`, { method: "DELETE" }),

  // Attendance (absensi/kehadiran)
  listAttendance: (subjectId, date) =>
    request(
      `/attendance?subjectId=${subjectId}${date ? `&date=${date}` : ""}`
    ),
  saveAttendance: (subjectId, date, entries) =>
    request("/attendance", {
      method: "POST",
      body: { subjectId, date, entries },
    }),

  // Statistics (statistik mata pelajaran)
  classStats: (subjectId) => request(`/subjects/${subjectId}/stats`),

  // Wali kelas (perwalian)
  homeroom: () => request("/homeroom"),
  homeroomStudent: (studentId) => request(`/homeroom/students/${studentId}`),
  setPromotion: (classId, studentId, decision) =>
    request(`/homeroom/${classId}/promotion`, {
      method: "PUT",
      body: { studentId, decision },
    }),

  // Announcements (pengumuman)
  listAnnouncements: () => request("/announcements"),
  createAnnouncement: (title, text) =>
    request("/announcements", { method: "POST", body: { title, text } }),
  createAnnouncementForm: (formData) =>
    request("/announcements", { method: "POST", body: formData, isForm: true }),
  updateAnnouncement: (id, patch) =>
    request(`/announcements/${id}`, { method: "PUT", body: patch }),
  updateAnnouncementForm: (id, formData) =>
    request(`/announcements/${id}`, {
      method: "PUT",
      body: formData,
      isForm: true,
    }),
  deleteAnnouncement: (id) =>
    request(`/announcements/${id}`, { method: "DELETE" }),
};
