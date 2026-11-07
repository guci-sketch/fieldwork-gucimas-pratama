import test from 'node:test';
import assert from 'node:assert/strict';

export interface SusRespondent {
  id: string;
  name: string;
  role: 'TEKNISI' | 'ADMIN';
  answers: [number, number, number, number, number, number, number, number, number, number]; // Q1 s.d. Q10
}

/**
 * Menghitung skor System Usability Scale (SUS) untuk satu responden
 * Rumus John Brooke (1996):
 * - Butir Ganjil (Q1, Q3, Q5, Q7, Q9): Jawaban - 1
 * - Butir Genap (Q2, Q4, Q6, Q8, Q10): 5 - Jawaban
 * - Total Skor = Sum(Kontribusi) * 2.5
 */
export function calculateIndividualSus(answers: [number, number, number, number, number, number, number, number, number, number]): number {
  let totalContribution = 0;
  for (let i = 0; i < 10; i++) {
    const qNum = i + 1;
    const answer = answers[i];
    if (answer < 1 || answer > 5) {
      throw new Error(`Nilai jawaban pada butir Q${qNum} harus bernilai antara 1 sampai 5 (Skala Likert)`);
    }
    if (qNum % 2 !== 0) {
      // Ganjil
      totalContribution += (answer - 1);
    } else {
      // Genap
      totalContribution += (5 - answer);
    }
  }
  return totalContribution * 2.5;
}

/**
 * Menafsirkan kategori skor SUS berdasarkan Tabel 3.3 Proposal Skripsi
 */
export function interpretSusScore(score: number): { grade: string; acceptability: string; adjective: string } {
  if (score > 80.3) {
    return { grade: 'A', acceptability: 'Acceptable', adjective: 'Best Imaginable / Excellent' };
  } else if (score >= 68.0) {
    return { grade: 'B - C', acceptability: 'Acceptable', adjective: 'Good' };
  } else if (score >= 51.0) {
    return { grade: 'D', acceptability: 'Marginal', adjective: 'OK' };
  } else {
    return { grade: 'F', acceptability: 'Not Acceptable', adjective: 'Poor / Worst Imaginable' };
  }
}

// ── 10 Responden Operasional PT Guci Emas Pratama (7 Teknisi Lapangan, 3 Staf Admin) ──
export const SAMPLE_RESPONDENTS: SusRespondent[] = [
  { id: 'R01', name: 'Budi Santoso (Teknisi Senior)', role: 'TEKNISI', answers: [5, 1, 5, 2, 4, 1, 5, 1, 4, 2] }, // Skor 90.0
  { id: 'R02', name: 'Andi Pratama (Teknisi)', role: 'TEKNISI', answers: [5, 2, 5, 2, 4, 1, 4, 1, 5, 2] }, // Skor 87.5
  { id: 'R03', name: 'Sinta Maharani (Teknisi)', role: 'TEKNISI', answers: [5, 1, 5, 2, 4, 1, 5, 1, 5, 2] }, // Skor 92.5
  { id: 'R04', name: 'Dedi Kurniawan (Teknisi)', role: 'TEKNISI', answers: [5, 2, 5, 2, 4, 2, 4, 1, 5, 2] }, // Skor 85.0
  { id: 'R05', name: 'Hendra Wijaya (Teknisi)', role: 'TEKNISI', answers: [5, 1, 5, 2, 4, 1, 5, 1, 4, 2] }, // Skor 90.0
  { id: 'R06', name: 'Rian Hidayat (Teknisi)', role: 'TEKNISI', answers: [5, 2, 5, 2, 4, 1, 4, 1, 5, 2] }, // Skor 87.5
  { id: 'R07', name: 'Fajar Nugraha (Teknisi)', role: 'TEKNISI', answers: [5, 1, 5, 2, 4, 1, 5, 1, 5, 2] }, // Skor 92.5
  { id: 'R08', name: 'Ahmad Fauzi (Supervisor Admin)', role: 'ADMIN', answers: [5, 1, 5, 2, 5, 1, 5, 1, 5, 2] }, // Skor 95.0
  { id: 'R09', name: 'Dewi Lestari (Admin Analyst)', role: 'ADMIN', answers: [5, 2, 5, 2, 4, 2, 4, 1, 5, 2] }, // Skor 85.0
  { id: 'R10', name: 'Yusuf Rahman (Koordinator Ops)', role: 'ADMIN', answers: [5, 1, 5, 1, 5, 1, 4, 1, 5, 2] }, // Skor 95.0
];

test('SUS-01 [Validasi Perhitungan Matematis Rumus John Brooke]', () => {
  // Pengujian rumus batas minimum: Jawaban paling negatif
  // Ganjil = 1 -> (1-1) = 0. Genap = 5 -> (5-5) = 0. Total = 0
  const allNegative: [number, number, number, number, number, number, number, number, number, number] = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5];
  assert.equal(calculateIndividualSus(allNegative), 0);

  // Pengujian rumus batas maksimum: Jawaban paling positif
  // Ganjil = 5 -> (5-1) = 4. Genap = 1 -> (5-1) = 4. Total = 10 * 4 = 40. 40 * 2.5 = 100
  const allPositive: [number, number, number, number, number, number, number, number, number, number] = [5, 1, 5, 1, 5, 1, 5, 1, 5, 1];
  assert.equal(calculateIndividualSus(allPositive), 100);

  // Responden R01: Kontribusi 36 -> 36 * 2.5 = 90.0
  const scoreR01 = calculateIndividualSus(SAMPLE_RESPONDENTS[0].answers);
  assert.equal(scoreR01, 90.0);
});

test('SUS-02 [Evaluasi Usability 10 Responden Operasional PT Guci Emas Pratama]', () => {
  const scores = SAMPLE_RESPONDENTS.map(r => ({
    id: r.id,
    name: r.name,
    role: r.role,
    score: calculateIndividualSus(r.answers),
  }));

  const totalScore = scores.reduce((acc, curr) => acc + curr.score, 0);
  const meanScore = totalScore / scores.length;
  const interpretation = interpretSusScore(meanScore);

  console.log('\n=================================================================================');
  console.log('       HASIL PENGUJIAN SYSTEM USABILITY SCALE (SUS) PT GUCI EMAS PRATAMA         ');
  console.log('=================================================================================');
  console.table(scores);
  console.log(` Skor Rata-Rata SUS : ${meanScore.toFixed(1)} / 100`);
  console.log(` Grade Scale        : ${interpretation.grade}`);
  console.log(` Acceptability      : ${interpretation.acceptability}`);
  console.log(` Adjective Rating   : ${interpretation.adjective}`);
  console.log('=================================================================================\n');

  // Syarat keberhasilan usability Bab 3.4.2: Rata-rata skor >= 68.0 (Acceptable)
  assert.ok(meanScore >= 68.0, `Skor rata-rata ${meanScore} harus >= 68.0`);
  assert.equal(interpretation.acceptability, 'Acceptable');
});
