import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { extractWebsiteProfile, mapCsvColumns, parseOpportunity } from '@pg/ai';
import { protectedProcedure, router } from '../trpc';

// Fetch a URL and reduce it to plain text for the website-extractor chain. Caps
// time + size; throws if the page can't be read or is too thin to extract from
// (the onboarding UI treats a thrown error as "fall back to manual entry").
async function fetchPageText(rawUrl: string): Promise<string> {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'PitchGeniusBot/1.0 (+onboarding scrape)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    html = (await res.text()).slice(0, 500_000);
  } catch {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not read that website.' });
  } finally {
    clearTimeout(timeout);
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12_000);
  if (text.length < 200) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not enough content on that page.' });
  }
  return text;
}

// AI-driven intake helpers. Both return parsed data for the user to review
// before any DB write — never auto-commit AI output.
export const parserRouter = router({
  // Onboarding website scrape (M30): fetch the seller's site + extract a profile.
  scrapeWebsite: protectedProcedure
    .input(z.object({ url: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const pageText = await fetchPageText(input.url);
      return extractWebsiteProfile(ctx.anthropic, pageText);
    }),

  parseQuickPaste: protectedProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return parseOpportunity(ctx.anthropic, input.text);
    }),

  mapCsvColumns: protectedProcedure
    .input(
      z.object({
        headers: z.array(z.string()).min(1),
        sampleRows: z.array(z.array(z.string())).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return mapCsvColumns(ctx.anthropic, input.headers, input.sampleRows);
    }),
});
