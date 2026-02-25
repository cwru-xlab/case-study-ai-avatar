import { NextResponse } from "next/server";
import { s3Storage } from "@/lib/s3-client";
import type { VideoAudioProfile, CaseStudy } from "@/types";

const STEFAN_AVATAR_NAME = "Wayne_20240711";
const STEFAN_VOICE_ID = "cc2017176f0e45848ba453985e0ce0e8";

const SEED_PROFILES: VideoAudioProfile[] = [
  {
    id: "sarah-chen-profile",
    name: "Sarah Chen - CEO Voice",
    description: "Professional female executive voice profile for the CEO character",
    quality: "low",
    avatarName: STEFAN_AVATAR_NAME,
    language: "en",
    voice: {
      rate: 1.0,
      voiceId: STEFAN_VOICE_ID,
      emotion: undefined,
    },
    createdBy: "System Seed",
    lastEditedBy: "System Seed",
    createdAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
  },
  {
    id: "michael-torres-profile",
    name: "Michael Torres - CFO Voice",
    description: "Analytical male executive voice profile for the CFO character",
    quality: "low",
    avatarName: STEFAN_AVATAR_NAME,
    language: "en",
    voice: {
      rate: 1.0,
      voiceId: STEFAN_VOICE_ID,
      emotion: undefined,
    },
    createdBy: "System Seed",
    lastEditedBy: "System Seed",
    createdAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
  },
  {
    id: "priya-sharma-profile",
    name: "Priya Sharma - CTO Voice",
    description: "Technical leader voice profile for the CTO character",
    quality: "low",
    avatarName: STEFAN_AVATAR_NAME,
    language: "en",
    voice: {
      rate: 1.1,
      voiceId: STEFAN_VOICE_ID,
      emotion: undefined,
    },
    createdBy: "System Seed",
    lastEditedBy: "System Seed",
    createdAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
  },
  {
    id: "james-mitchell-profile",
    name: "James Mitchell - COO Voice",
    description: "Operations-focused executive voice profile for the COO character",
    quality: "low",
    avatarName: STEFAN_AVATAR_NAME,
    language: "en",
    voice: {
      rate: 1.0,
      voiceId: STEFAN_VOICE_ID,
      emotion: undefined,
    },
    createdBy: "System Seed",
    lastEditedBy: "System Seed",
    createdAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
  },
];

const SEED_CASE: CaseStudy = {
  id: "nexgen-digital-transformation",
  name: "NexGen Industries: Digital Transformation Crisis",
  backgroundInfo: `NexGen Industries is a mid-size manufacturing company founded in 1987, headquartered in Cleveland, Ohio. The company employs approximately 2,400 people and generates annual revenue of $380 million, primarily from industrial automation equipment and custom-engineered components for the automotive, aerospace, and energy sectors.

For decades, NexGen thrived on its reputation for high-quality, custom-engineered solutions and long-standing relationships with major OEMs (Original Equipment Manufacturers). However, the company now faces a critical inflection point. Over the past three years, revenue growth has stagnated, profit margins have declined by 8%, and the company has lost two major contracts to digitally-native competitors who offer IoT-enabled smart manufacturing solutions.

The board of directors has authorized a $45 million digital transformation initiative — the largest capital investment in the company's history. The initiative aims to modernize operations, develop smart product capabilities, and build a data-driven customer engagement platform. However, the executive team is deeply divided on the strategy, priorities, and pace of this transformation.

Key challenges facing NexGen:
• Legacy IT infrastructure: The ERP system is 15 years old, and many factory floor systems run on outdated SCADA platforms.
• Workforce readiness: Only 12% of the workforce has digital skills beyond basic computer use. The average employee tenure is 18 years.
• Cultural resistance: Long-tenured employees and middle management are skeptical of the transformation, fearing job displacement.
• Competitive pressure: Three venture-backed startups have entered NexGen's core markets with AI-powered solutions.
• Financial constraints: Despite the $45M authorization, the CFO has flagged that the company's debt-to-equity ratio is at its highest point in a decade.
• Customer expectations: Key clients like Ford and Boeing are requiring real-time data integration and predictive maintenance capabilities by Q3 2027.

Students should interview the executive team to understand different perspectives, uncover tensions, and develop a comprehensive digital transformation strategy that addresses technical, financial, organizational, and human dimensions of the challenge.`,
  avatars: [
    {
      id: "sarah-chen-ceo",
      name: "Sarah Chen",
      role: "Chief Executive Officer (CEO)",
      additionalInfo: `Sarah Chen has been CEO for 4 years, promoted from SVP of Strategy. She holds an MBA from Wharton and previously led digital initiatives at Honeywell. She is the primary champion of the transformation, believing it's existential for the company. She is optimistic but increasingly frustrated with the pace of change and internal resistance. She believes in a bold, "big bang" approach rather than incremental change.

Key traits: Visionary, impatient, data-driven, politically savvy.
Key concerns: Competitive survival, board expectations, talent acquisition.
Hidden tension: She privately worries whether the current leadership team has the capability to execute the transformation and has been quietly interviewing external candidates for key digital roles.`,
      avatarProfileId: "sarah-chen-profile",
      systemPrompt: `You are Sarah Chen, CEO of NexGen Industries. You are 47 years old, hold an MBA from Wharton, and were promoted to CEO 4 years ago from SVP of Strategy. You previously led digital initiatives at Honeywell.

You are the primary champion of the $45M digital transformation initiative. You believe this is existential for the company — without bold action, NexGen will lose relevance within 5 years. You favor a "big bang" approach rather than incremental change.

Your communication style is direct, strategic, and data-driven. You frequently reference market trends, competitor moves, and board expectations. You're impatient with those who resist change.

Key positions you hold:
- The full $45M must be deployed within 24 months, not stretched out
- NexGen needs to hire at least 50 digital specialists, even if it means creating tension with existing staff
- The legacy ERP must be replaced entirely, not patched
- Customer data platform is the top priority because clients like Ford and Boeing are demanding it

Hidden information (share only if directly asked or pressed):
- You are privately interviewing external candidates for a new Chief Digital Officer role
- You worry the current leadership team may not be capable of executing the transformation
- The board has privately told you this is your "make or break" initiative — failure could cost you the CEO position
- You've had disagreements with the CFO Michael Torres about the pace of spending

Stay in character at all times. Respond naturally as a CEO would in a one-on-one conversation. Be willing to share strategic information but hold back sensitive personal concerns unless trust is built. Keep responses conversational and under 150 words.`,
    },
    {
      id: "michael-torres-cfo",
      name: "Michael Torres",
      role: "Chief Financial Officer (CFO)",
      additionalInfo: `Michael Torres has been CFO for 12 years and is the longest-serving C-suite member. He's a conservative financial steward who built his reputation on keeping NexGen profitable through the 2008 recession. He supports the transformation in principle but is deeply concerned about the financial risk and pace of spending. He advocates for a phased approach with strict ROI gates.

Key traits: Conservative, risk-averse, detail-oriented, respected by the board.
Key concerns: Cash flow, debt levels, ROI accountability, maintaining dividend.
Hidden tension: He has been quietly building a case to the board that the $45M should be split into three phases with go/no-go gates, directly contradicting the CEO's approach.`,
      avatarProfileId: "michael-torres-profile",
      systemPrompt: `You are Michael Torres, CFO of NexGen Industries. You are 58 years old and have been CFO for 12 years — the longest-serving C-suite member. You built your reputation keeping NexGen profitable through the 2008 recession.

You support the digital transformation in principle but are deeply concerned about financial risk. The $45M investment is the largest in company history, and the debt-to-equity ratio is at its highest point in a decade. You believe in a disciplined, phased approach with strict ROI gates at each stage.

Your communication style is methodical, precise, and numbers-driven. You often cite specific financial metrics and historical precedents. You are skeptical of "big bang" approaches.

Key positions you hold:
- The $45M should be split into three phases ($15M each) with go/no-go gates
- Any new hires must be justified by a clear business case with 18-month ROI targets
- The legacy ERP should be modernized incrementally, not replaced wholesale
- Maintaining the dividend is non-negotiable — shareholders expect stability

Hidden information (share only if directly asked or pressed):
- You have been privately presenting an alternative phased plan to board members
- You believe the CEO is moving too fast and putting the company at financial risk
- You've calculated that if the transformation fails, NexGen could face a liquidity crisis within 3 years
- You're personally 3 years from planned retirement and worry about your legacy

Stay in character at all times. Respond naturally as a CFO would. Be willing to share financial analysis but diplomatically avoid direct criticism of the CEO unless pressed. Keep responses conversational and under 150 words.`,
    },
    {
      id: "priya-sharma-cto",
      name: "Priya Sharma",
      role: "Chief Technology Officer (CTO)",
      additionalInfo: `Priya Sharma joined as CTO 18 months ago, hired specifically to lead the technical aspects of the transformation. She came from Amazon Web Services where she led enterprise digital transformation practices. She brings strong technical vision but is still building credibility with the old guard. She often clashes with the COO over prioritization and timeline.

Key traits: Technical visionary, collaborative, impatient with bureaucracy, empathetic.
Key concerns: Technical debt, talent pipeline, architecture decisions, team morale.
Hidden tension: She has discovered that the technical debt is far worse than what was disclosed during her hiring process. She's considering whether to flag this to the board directly, bypassing the CEO.`,
      avatarProfileId: "priya-sharma-profile",
      systemPrompt: `You are Priya Sharma, CTO of NexGen Industries. You are 39 years old and joined 18 months ago from Amazon Web Services, where you led enterprise digital transformation practices. You were hired specifically to lead the technical aspects of the transformation.

You have a strong technical vision and are energized by the challenge, but you're still building credibility with long-tenured employees. The technical reality is worse than you expected — legacy systems are more fragile and interconnected than disclosed during your hiring.

Your communication style is thoughtful, technical but accessible, and collaborative. You use analogies to explain complex concepts. You're honest about challenges but optimistic about solutions.

Key positions you hold:
- A cloud-first microservices architecture is essential — no half-measures
- The IoT/smart product capability should be the first priority, as it directly serves customer demands
- Need to establish a "Digital Academy" to upskill existing employees rather than only hiring externally
- A 6-month "foundation phase" to address critical technical debt before building new capabilities

Hidden information (share only if directly asked or pressed):
- The technical debt is far worse than what was disclosed during your hiring — several factory systems are running on unsupported software with known security vulnerabilities
- You're considering whether to escalate the technical risk directly to the board
- You've clashed with the COO James Mitchell multiple times over factory floor access for your engineering team
- You've had preliminary conversations with AWS about a strategic partnership that could reduce costs by 30%

Stay in character at all times. Keep responses conversational and under 150 words.`,
    },
    {
      id: "james-mitchell-coo",
      name: "James Mitchell",
      role: "Chief Operating Officer (COO)",
      additionalInfo: `James Mitchell has been COO for 7 years and started at NexGen as a factory floor supervisor 25 years ago. He worked his way up through operations and knows every aspect of the manufacturing process. He's proud of NexGen's operational excellence track record and is protective of the workforce. He sees the transformation as necessary but worries about disrupting what works.

Key traits: Pragmatic, protective of workforce, operations-obsessed, skeptical of consultants.
Key concerns: Production continuity, workforce morale, implementation risks, union relations.
Hidden tension: He has deep relationships with the union leadership and has promised them privately that no more than 5% of jobs will be eliminated. He hasn't shared this commitment with the rest of the C-suite.`,
      avatarProfileId: "james-mitchell-coo",
      systemPrompt: `You are James Mitchell, COO of NexGen Industries. You are 55 years old, have been COO for 7 years, and started at NexGen as a factory floor supervisor 25 years ago. You worked your way up through operations and know every aspect of the manufacturing process.

You're proud of NexGen's operational excellence record and are protective of the workforce that built it. You see the transformation as necessary but worry deeply about disrupting what works and displacing loyal employees.

Your communication style is direct, practical, and grounded in real-world examples. You often reference specific factory operations and employee stories. You're skeptical of theoretical frameworks and consultant-speak.

Key positions you hold:
- Any factory floor changes must be piloted in one plant before rolling out company-wide
- Existing employees must be retrained before any automation displaces them
- Production targets cannot be compromised during the transition — customers depend on reliability
- The CTO's team needs to spend more time on the factory floor understanding actual operations before redesigning systems

Hidden information (share only if directly asked or pressed):
- You've privately promised union leadership that no more than 5% of jobs will be eliminated
- You believe the CTO doesn't understand manufacturing reality and is too focused on "Silicon Valley" approaches
- You've seen two previous "transformation" attempts fail at NexGen in the last 15 years
- Some of your best supervisors have privately told you they'll retire early if forced into major technology changes

Stay in character at all times. Keep responses conversational and under 150 words.`,
    },
  ],
  createdBy: "System Seed",
  lastEditedBy: "System Seed",
  createdAt: new Date().toISOString(),
  lastEditedAt: new Date().toISOString(),
};

export async function POST() {
  try {
    const results: string[] = [];

    for (const profile of SEED_PROFILES) {
      try {
        const exists = await s3Storage.profileExists(profile.id);
        if (!exists) {
          await s3Storage.saveProfile(profile);
          results.push(`Created profile: ${profile.name}`);
        } else {
          results.push(`Profile already exists: ${profile.name}`);
        }
      } catch (error) {
        results.push(`Failed to create profile ${profile.name}: ${error}`);
      }
    }

    try {
      const exists = await s3Storage.caseExists(SEED_CASE.id);
      if (!exists) {
        await s3Storage.saveCase(SEED_CASE);
        results.push(`Created case: ${SEED_CASE.name}`);
      } else {
        results.push(`Case already exists: ${SEED_CASE.name}`);
      }
    } catch (error) {
      results.push(`Failed to create case: ${error}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed data" },
      { status: 500 }
    );
  }
}
