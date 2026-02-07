/**
 * POST /api/analytics/predictions
 *
 * Body: { organizationId: string, filters: AnalyticsFilters }
 * Returns: Prediction[]
 *
 * Endpoint dedie pour les predictions et recommandations IA.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsService } from '@/lib/analytics/analytics-service';
import type { AnalyticsFilters } from '@/lib/analytics/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, filters } = body as {
      organizationId: string;
      filters: AnalyticsFilters;
    };

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 },
      );
    }

    const validPeriods = ['7d', '30d', '90d', '12m'];
    if (!filters?.period || !validPeriods.includes(filters.period)) {
      return NextResponse.json(
        { error: 'Invalid period. Use: 7d, 30d, 90d, 12m' },
        { status: 400 },
      );
    }

    const predictions = await AnalyticsService.getPredictions(
      organizationId,
      filters,
    );

    return NextResponse.json(predictions);
  } catch (err) {
    console.error('Analytics predictions error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
