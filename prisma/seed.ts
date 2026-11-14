import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { relevanceScore } from "../src/lib/slr";
const prisma = new PrismaClient();
const ARTICLES: Array<[string, string, number, string, string, string, string]> = [
  ["Pengaruh Pembelajaran Daring terhadap Hasil Belajar Mahasiswa di Indonesia", "Sari, D.; Wijaya, A.", 2023, "Jurnal Pendidikan Indonesia", "SINTA", "10.1234/jpi.2023.001", "Penelitian ini mengkaji pengaruh pembelajaran daring terhadap hasil belajar mahasiswa selama dan sesudah pandemi, dengan tinjauan sistematis terhadap 42 studi di Indonesia."],
  ["Systematic Review of Online Learning Effectiveness in Higher Education", "Chen, L.; Kumar, R.", 2022, "Computers & Education", "Scopus", "10.1016/j.compedu.2022.104", "A systematic review of 68 studies on online learning effectiveness, student engagement, and learning outcomes in higher education."],
  ["Blended Learning dan Motivasi Belajar Siswa Sekolah Menengah", "Putri, M.; Hartono, B.", 2024, "Jurnal Teknologi Pendidikan", "Garuda", "", "Studi ini menelaah blended learning dan motivasi belajar siswa melalui tinjauan literatur sistematis dari jurnal nasional terindeks Garuda."],
  ["Gamification in Education: A Systematic Literature Review", "Deterding, S.; et al.", 2021, "Educational Technology Research", "WoS", "10.1007/s11423-021-099", "This review synthesises evidence on gamification, motivation, and achievement across 54 empirical studies."],
  ["Penggunaan Artificial Intelligence dalam Pembelajaran Adaptif", "Rahmawati, N.; Santoso, P.", 2024, "Jurnal Ilmu Pendidikan", "SINTA", "10.1234/jip.2024.077", "Tinjauan sistematis tentang AI adaptif, personalisasi pembelajaran, dan hasil belajar di perguruan tinggi Indonesia."],
  ["Mobile Learning for Rural Students: Evidence from Southeast Asia", "Nguyen, T.; Lim, S.", 2023, "Asia Pacific Education Review", "Scopus", "10.1007/s12564-023-098", "Evidence on mobile learning access, equity, and outcomes for rural students in Southeast Asia."],
  ["Efektivitas Microlearning pada Pelatihan Guru", "Anggraini, R.; Pratama, Y.", 2022, "Jurnal Penelitian Pendidikan", "Garuda", "", "Microlearning meningkatkan retensi guru dalam pelatihan daring menurut tinjauan 23 studi."],
  ["A PRISMA-Based Review of Flipped Classroom Research", "Bishop, J.; Verleger, M.", 2022, "Review of Educational Research", "WoS", "10.3102/0034654322", "A PRISMA 2020 review of flipped classroom designs and student outcomes."],
  ["Pembelajaran Daring terhadap Hasil Belajar Mahasiswa di Indonesia", "Sari, D.; Wijaya, A.", 2023, "Jurnal Pendidikan Indonesia", "DOAJ", "10.1234/jpi.2023.001", "Duplikat dari artikel Scopus/SINTA — judul dan DOI sama, sumber berbeda (DOAJ)."],
  ["Self-Regulated Learning in Online Courses: A Meta-Analysis", "Zimmerman, B.; Moylan, A.", 2021, "Contemporary Educational Psychology", "Scopus", "10.1016/j.cedpsych.2021.101", "Meta-analysis of self-regulated learning strategies and achievement in online courses."],
  ["Literasi Digital Mahasiswa di Era Kampus Merdeka", "Kusuma, F.; Dewi, L.", 2024, "Jurnal Pendidikan Tinggi", "SINTA", "", "Tinjauan literatur tentang literasi digital mahasiswa Indonesia dalam program Kampus Merdeka."],
  ["Teacher Presence and Student Satisfaction in Virtual Classrooms", "Garrison, D.; Anderson, T.", 2023, "Internet and Higher Education", "WoS", "10.1016/j.iheduc.2023.100", "Community of inquiry, teacher presence, and satisfaction in virtual classrooms."],
  ["Evaluasi Program MBKM terhadap Kesiapan Kerja Lulusan", "Hidayat, A.; Nur, S.", 2024, "Jurnal Kebijakan Pendidikan", "Garuda", "", "Evaluasi MBKM dan kesiapan kerja lulusan perguruan tinggi Indonesia."],
  ["Adaptive Learning Systems: A Systematic Review", "Brusilovsky, P.; Millán, E.", 2022, "User Modeling and User-Adapted Interaction", "Scopus", "10.1007/s11257-022-093", "Systematic review of adaptive learning systems, learner modelling, and personalisation."],
  ["Motivasi Belajar Mahasiswa Pascasarjana secara Daring", "Wulandari, E.; Gunawan, H.", 2023, "Jurnal Psikologi Pendidikan", "DOAJ", "", "Motivasi intrinsik dan ekstrinsik mahasiswa pascasarjana dalam pembelajaran daring."],
  ["Open Educational Resources in Indonesian Universities", "Setiawan, B.; et al.", 2024, "International Journal of Educational Technology", "DOAJ", "10.1234/ijet.2024.012", "Adoption of open educational resources in Indonesian universities: a systematic review."],
];
async function main() {
  const user = await prisma.user.upsert({ where: { email: "demo@litara.id" }, update: {}, create: { name: "Demo Litara", email: "demo@litara.id", passwordHash: hashPassword("demo1234") } });
  await prisma.subscription.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, plan: "free" } });
  const q = "pengaruh pembelajaran daring terhadap hasil belajar mahasiswa Indonesia";
  const project = await prisma.project.create({ data: { title: "Pengaruh Pembelajaran Daring terhadap Hasil Belajar", researchQuestion: q, inclusion: "Studi 2020-2025, mahasiswa, pembelajaran daring", exclusion: "Bukan studi empiris, tanpa teks penuh", ownerId: user.id, reviewers: { create: [{ name: "Demo Litara" }, { name: "Reviewer 2" }] } } });
  const seen = new Set<string>();
  for (const [title, authors, year, journal, source, doi, abs] of ARTICLES) {
    const dup = doi && seen.has(doi.toLowerCase());
    if (doi) seen.add(doi.toLowerCase());
    await prisma.article.create({ data: { projectId: project.id, title, authors, year, journal, source, doi, abstract: abs, relevance: relevanceScore({ title, authors, year, journal, source, doi, abstract: abs }, q), duplicateOfId: dup ? "doi-duplikat" : null } });
  }
  console.log("Seed selesai. Login demo: demo@litara.id / demo1234");
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
