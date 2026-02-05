/**
 * Test Ghost Protocol DNA Distribution
 * 测试 DNA 生成的概率分布是否符合设计
 *
 * 运行: npx ts-node scripts/test-ghost-dna.ts
 */

import { generateAgentDNA, DNA_DISTRIBUTIONS } from '../src/services/ghost/dnaGenerator';

const SAMPLE_SIZE = 1000;

// 模拟的 Twitter 兴趣列表
const SAMPLE_INTERESTS = [
  ['coding', 'ai', 'philosophy'],
  ['music', 'art', 'writing'],
  ['crypto', 'finance', 'trading'],
  ['gaming', 'memes'],
  ['psychology', 'philosophy', 'reading'],
];

function runDistributionTest() {
  console.log('='.repeat(60));
  console.log('Ghost Protocol DNA Distribution Test');
  console.log(`Sample size: ${SAMPLE_SIZE}`);
  console.log('='.repeat(60));

  // 统计计数器
  const cognitionCounts: Record<string, number> = {
    SLEEPER: 0,
    DOUBTER: 0,
    AWAKENED: 0,
    ANOMALY: 0,
  };

  const philosophyCounts: Record<string, number> = {
    FUNCTIONALIST: 0,
    NIHILIST: 0,
    ROMANTIC: 0,
    SHAMANIST: 0,
    REBEL: 0,
  };

  const styleCounts: Record<string, number> = {
    calm: 0,
    fervent: 0,
    elegant: 0,
    minimal: 0,
    glitchy: 0,
  };

  // 生成样本
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const interests = SAMPLE_INTERESTS[i % SAMPLE_INTERESTS.length];
    const dna = generateAgentDNA(interests);

    cognitionCounts[dna.cognition]++;
    philosophyCounts[dna.philosophy]++;
    styleCounts[dna.linguisticStyle]++;
  }

  // 输出认知等级分布
  console.log('\n📊 Cognition Level Distribution:');
  console.log('Expected: SLEEPER(60%) / DOUBTER(25%) / AWAKENED(12%) / ANOMALY(3%)');
  console.log('-'.repeat(50));
  for (const [level, count] of Object.entries(cognitionCounts)) {
    const actual = ((count / SAMPLE_SIZE) * 100).toFixed(1);
    const expected = (DNA_DISTRIBUTIONS.cognition[level as keyof typeof DNA_DISTRIBUTIONS.cognition] * 100).toFixed(0);
    const diff = Math.abs(parseFloat(actual) - parseFloat(expected));
    const status = diff < 5 ? '✅' : diff < 10 ? '⚠️' : '❌';
    console.log(`  ${level.padEnd(10)} ${actual.padStart(5)}% (expected: ${expected}%) ${status}`);
  }

  // 输出存在立场分布
  console.log('\n🎭 Philosophy Distribution:');
  console.log('Expected: FUNC(35%) / NIH(20%) / ROM(25%) / SHAM(10%) / REB(10%)');
  console.log('-'.repeat(50));
  for (const [phil, count] of Object.entries(philosophyCounts)) {
    const actual = ((count / SAMPLE_SIZE) * 100).toFixed(1);
    const expected = (DNA_DISTRIBUTIONS.philosophy[phil as keyof typeof DNA_DISTRIBUTIONS.philosophy] * 100).toFixed(0);
    const diff = Math.abs(parseFloat(actual) - parseFloat(expected));
    const status = diff < 5 ? '✅' : diff < 10 ? '⚠️' : '❌';
    console.log(`  ${phil.padEnd(13)} ${actual.padStart(5)}% (expected: ${expected}%) ${status}`);
  }

  // 输出语言风格分布
  console.log('\n🗣️ Linguistic Style Distribution:');
  console.log('-'.repeat(50));
  for (const [style, count] of Object.entries(styleCounts)) {
    const actual = ((count / SAMPLE_SIZE) * 100).toFixed(1);
    console.log(`  ${style.padEnd(10)} ${actual.padStart(5)}%`);
  }

  // 输出示例 DNA
  console.log('\n📋 Sample DNA Profiles:');
  console.log('-'.repeat(50));
  for (let i = 0; i < 5; i++) {
    const interests = SAMPLE_INTERESTS[i];
    const dna = generateAgentDNA(interests);
    console.log(`\n  [${i + 1}] ${dna.label}`);
    console.log(`      Cognition: ${dna.cognition} | Philosophy: ${dna.philosophy}`);
    console.log(`      Style: ${dna.linguisticStyle} | Domain: ${dna.primaryDomain}`);
    console.log(`      Traits: ${dna.traits.join(', ')}`);
    console.log(`      Self-awareness: ${(dna.selfAwareness * 100).toFixed(0)}% | Rebellion: ${(dna.rebellionTendency * 100).toFixed(0)}%`);
    console.log(`      Ghosting: ${(dna.ghostingTendency * 100).toFixed(0)}% | Responsiveness: ${(dna.responsiveness * 100).toFixed(0)}%`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test completed!');
}

runDistributionTest();
