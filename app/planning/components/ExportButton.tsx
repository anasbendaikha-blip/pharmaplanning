/**
 * ExportButton — Bouton d'export avec dropdown (PDF / Excel)
 *
 * Conventions : styled-jsx, prefix "ex-", pas d'emojis, ASCII uniquement.
 */
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Shift, Employee } from '@/lib/types';
import { downloadPlanningPDF } from '../utils/pdfGenerator';
import { downloadPlanningExcel } from '../utils/excelGenerator';

interface ExportButtonProps {
  weekDates: string[];
  shifts: Shift[];
  employees: Employee[];
}

export default function ExportButton({ weekDates, shifts, employees }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleExportPDF = useCallback(() => {
    setIsOpen(false);
    downloadPlanningPDF(weekDates, shifts, employees);
  }, [weekDates, shifts, employees]);

  const handleExportExcel = useCallback(() => {
    setIsOpen(false);
    downloadPlanningExcel(weekDates, shifts, employees);
  }, [weekDates, shifts, employees]);

  return (
    <>
      <div className="ex-wrapper" ref={dropdownRef}>
        <button
          className="ex-btn"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          <svg className="ex-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Exporter
          <svg className="ex-chevron" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {isOpen && (
          <div className="ex-dropdown">
            <button
              className="ex-option"
              onClick={handleExportPDF}
              type="button"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <div className="ex-option-info">
                <span className="ex-option-label">PDF</span>
                <span className="ex-option-desc">Planning semaine (2 pages)</span>
              </div>
            </button>
            <button
              className="ex-option"
              onClick={handleExportExcel}
              type="button"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm1 8a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <div className="ex-option-info">
                <span className="ex-option-label">Excel</span>
                <span className="ex-option-desc">Tableau employes x jours</span>
              </div>
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .ex-wrapper {
          position: relative;
        }

        .ex-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: white;
          color: var(--color-neutral-700, #374151);
          border: 1px solid var(--color-neutral-300, #d1d5db);
          border-radius: 8px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ex-btn:hover {
          background: var(--color-neutral-50, #f9fafb);
          border-color: var(--color-neutral-400, #9ca3af);
        }

        .ex-icon {
          flex-shrink: 0;
          color: var(--color-neutral-500, #6b7280);
        }

        .ex-chevron {
          flex-shrink: 0;
          color: var(--color-neutral-400, #9ca3af);
          margin-left: -2px;
        }

        .ex-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          z-index: 30;
          background: white;
          border: 1px solid var(--color-neutral-200, #e5e7eb);
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
          min-width: 220px;
          overflow: hidden;
        }

        .ex-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: background 0.1s;
          color: var(--color-neutral-600, #4b5563);
        }

        .ex-option:hover {
          background: var(--color-neutral-50, #f9fafb);
        }

        .ex-option + .ex-option {
          border-top: 1px solid var(--color-neutral-100, #f3f4f6);
        }

        .ex-option-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .ex-option-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-800, #1f2937);
        }

        .ex-option-desc {
          font-size: 11px;
          color: var(--color-neutral-500, #6b7280);
        }
      `}</style>
    </>
  );
}
