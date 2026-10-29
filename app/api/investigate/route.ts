import { NextRequest, NextResponse } from 'next/server';
import { runInvestigation } from '@/agent/investigator';
import { InvestigateRequestSchema } from '@/model/schemas';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InvestigateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request parameters',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { repoPath, question, focusFile, model } = parsed.data;

    const output = await runInvestigation({
      repoPath,
      question,
      focusFile,
      model,
    });

    return NextResponse.json({
      success: true,
      report: output.report,
      validation: output.validation,
      modelUsed: output.modelUsed,
      inferenceMode: output.inferenceMode,
      events: output.events,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[GHOSTTRACE_INVESTIGATE_ERROR]', message);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
