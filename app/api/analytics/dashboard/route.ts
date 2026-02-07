/**
 * POST /api/analytics/dashboard
 *
 * Body: { organizationId: string, filters: AnalyticsFilters }
 * Returns: AnalyticsDashboard
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

    console.log('📊 Analytics dashboard request:', { organizationId, period: filters.period });

    const dashboard = await AnalyticsService.getDashboard(organizationId, filters);

    console.log('✅ Analytics dashboard computed:', {
      totalHours: dashboard.kpis.totalHours.value,
      totalShifts: dashboard.kpis.totalShifts.value,
      predictions: dashboard.predictions.length,
    });

    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('❌ Analytics dashboard error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
