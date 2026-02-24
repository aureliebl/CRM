"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocale } from "@/lib/use-locale";

export interface ColumnDefinition<T> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
  filterType?: "text" | "select" | "date" | "number" | "none";
  selectOptions?: { value: string; label: string }[];
  isFilterable?: boolean;
}

export type ColumnDefition<T> = ColumnDefinition<T>;

interface TableWithColumnFiltersProps<T> {
  data: T[];
  columns: ColumnDefinition<T>[];
  title: string;
  description?: string;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  stickyFilters?: boolean;
  stickyFiltersTop?: string;
  onRowClick?: (item: T) => void;
}

export function TableWithColumnFilters<T extends { id: string }>({
  data,
  columns,
  title,
  description,
  defaultPageSize = 25,
  pageSizeOptions = [25, 50, 100],
  stickyFilters = true,
  stickyFiltersTop = "1rem",
  onRowClick,
}: TableWithColumnFiltersProps<T>) {
  const { locale } = useLocale();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [measuredColumnWidths, setMeasuredColumnWidths] = useState<Record<string, string>>({});
  const headerRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const dataTableWrapperRef = useRef<HTMLDivElement | null>(null);
  const filterWrapperRef = useRef<HTMLDivElement | null>(null);

  const columnsByKey = useMemo(() => {
    const map = new Map<string, ColumnDefinition<T>>();
    columns.forEach((column) => {
      map.set(String(column.key), column);
    });
    return map;
  }, [columns]);

  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([, value]) => value.trim() !== ""),
    [filters]
  );

  const filteredData = useMemo(() => {
    if (activeFilters.length === 0) return data;

    return data.filter((item) => {
      return activeFilters.every(([key, filterValue]) => {
        const column = columnsByKey.get(key);
        if (!column) return true;

        const itemValue = item[key as keyof T];
        const normalizedItemValue = String(itemValue ?? "").toLowerCase();

        if (column.filterType === "select") {
          return normalizedItemValue === filterValue.toLowerCase();
        }

        if (column.filterType === "date") {
          // filterValue format: "FROM|TO" where each side can be empty
          const [from, to] = filterValue.split("|");
          const itemStr = normalizedItemValue;
          const d = new Date(String(itemValue ?? ""));
          if (Number.isNaN(d.getTime())) return !from && !to;
          const ts = d.getTime();
          if (from) { const fd = new Date(from); if (!Number.isNaN(fd.getTime()) && ts < fd.getTime()) return false; }
          if (to) { const td = new Date(to + "T23:59:59"); if (!Number.isNaN(td.getTime()) && ts > td.getTime()) return false; }
          return true;
        }

        if (column.filterType === "number") {
          // filterValue format: "MIN|MAX" where each side can be empty
          const [minStr, maxStr] = filterValue.split("|");
          const num = Number(itemValue);
          if (Number.isNaN(num)) return !minStr && !maxStr;
          if (minStr) { const min = Number(minStr); if (!Number.isNaN(min) && num < min) return false; }
          if (maxStr) { const max = Number(maxStr); if (!Number.isNaN(max) && num > max) return false; }
          return true;
        }

        // Flexible text search: split by whitespace, all words must match (AND)
        const words = filterValue.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return true;
        return words.every((word) => normalizedItemValue.includes(word));
      });
    });
  }, [activeFilters, columnsByKey, data]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];

      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;

      if (typeof left === "number" && typeof right === "number") {
        return left - right;
      }

      return String(left).localeCompare(String(right), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [filteredData, sortDirection, sortKey]);

  const totalRows = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSortChange = (key: keyof T) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
      return;
    }

    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }

    setSortKey(null);
    setSortDirection("asc");
  };

  const filterableColumns = useMemo(
    () => columns.filter((c) => c.isFilterable !== false && c.filterType !== "none"),
    [columns]
  );

  const getColumnWidth = (column: ColumnDefinition<T>) => {
    if (column.width) return column.width;
    if (String(column.label).trim() === "") return "52px";
    return undefined;
  };

  const getEffectiveColumnWidth = useCallback(
    (column: ColumnDefinition<T>) => {
      const key = String(column.key);
      return measuredColumnWidths[key] || getColumnWidth(column);
    },
    [measuredColumnWidths]
  );

  const syncMeasuredColumnWidths = useCallback(() => {
    setMeasuredColumnWidths((prev) => {
      const next: Record<string, string> = {};

      columns.forEach((column) => {
        const key = String(column.key);
        const predefinedWidth = getColumnWidth(column);

        if (predefinedWidth) {
          next[key] = predefinedWidth;
          return;
        }

        const headerCell = headerRefs.current[key];
        if (!headerCell) return;

        const width = Math.ceil(headerCell.getBoundingClientRect().width);
        if (width > 0) {
          next[key] = `${width}px`;
        }
      });

      const sameSize =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.keys(next).every((key) => prev[key] === next[key]);

      return sameSize ? prev : next;
    });
  }, [columns]);

  useEffect(() => {
    const frame = requestAnimationFrame(syncMeasuredColumnWidths);
    return () => cancelAnimationFrame(frame);
  }, [syncMeasuredColumnWidths, paginatedData, filters, sortKey, sortDirection, pageSize]);

  useEffect(() => {
    const tableWrapper = dataTableWrapperRef.current;
    if (!tableWrapper || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      syncMeasuredColumnWidths();
    });

    observer.observe(tableWrapper);
    return () => observer.disconnect();
  }, [syncMeasuredColumnWidths]);

  // Sync horizontal scroll between filter bar and data table
  useEffect(() => {
    const filterEl = filterWrapperRef.current;
    const dataEl = dataTableWrapperRef.current;
    if (!filterEl || !dataEl) return;

    let ticking = false;
    const syncFromData = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        filterEl.scrollLeft = dataEl.scrollLeft;
        ticking = false;
      });
    };
    const syncFromFilter = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        dataEl.scrollLeft = filterEl.scrollLeft;
        ticking = false;
      });
    };

    dataEl.addEventListener("scroll", syncFromData, { passive: true });
    filterEl.addEventListener("scroll", syncFromFilter, { passive: true });
    return () => {
      dataEl.removeEventListener("scroll", syncFromData);
      filterEl.removeEventListener("scroll", syncFromFilter);
    };
  }, [filterableColumns.length]);

  const labels = useMemo(
    () =>
      locale === "fr"
        ? {
            filtersTitle: "Filtres",
            all: "Tous",
            filter: "Filtrer...",
            lines: "ligne",
            page: "page",
            rowsPerPage: "Lignes / page",
            noResult: "Aucun résultat ne correspond à vos filtres",
            previous: "Précédent",
            next: "Suivant",
            sortAsc: "Tri croissant",
            sortDesc: "Tri décroissant",
            sortNone: "Aucun tri",
          }
        : {
            filtersTitle: "Filters",
            all: "All",
            filter: "Filter...",
            lines: "row",
            page: "page",
            rowsPerPage: "Rows / page",
            noResult: "No results match your filters",
            previous: "Previous",
            next: "Next",
            sortAsc: "Ascending",
            sortDesc: "Descending",
            sortNone: "No sort",
          },
    [locale]
  );

  const filterControlStyle: React.CSSProperties = {
    width: "100%",
    height: "2rem",
    padding: "0.35rem 0.5rem",
    borderRadius: "0.4rem",
    border: "1px solid var(--border-color)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: "0.75rem",
    boxSizing: "border-box",
  };

  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, item: T) => {
    if (!onRowClick) return;

    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "button, a, input, select, textarea, [data-row-action='true']"
      )
    ) {
      return;
    }

    onRowClick(item);
  };

  return (
    <>
      {filterableColumns.length > 0 && (
        <section
          className="admin-placeholder-card"
          style={{
            marginBottom: "1rem",
            ...(stickyFilters
              ? {
                  position: "sticky",
                  top: stickyFiltersTop,
                  zIndex: 5,
                }
              : {}),
          }}
        >
          <div className="admin-placeholder-title">{labels.filtersTitle}</div>
          <div style={{ overflowX: "auto", marginTop: "0.6rem" }} ref={filterWrapperRef}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.8rem",
                tableLayout: "fixed",
                minWidth: columns.length > 5 ? `${columns.length * 150}px` : undefined,
              }}
            >
              <colgroup>
                {columns.map((column) => (
                  <col
                    key={String(column.key)}
                    style={{ width: getEffectiveColumnWidth(column) || "150px" }}
                  />
                ))}
              </colgroup>
              <tbody>
                <tr>
                  {columns.map((column) => {
                    const key = String(column.key);
                    const isFilterable =
                      column.isFilterable !== false && column.filterType !== "none";

                    return (
                      <td
                        key={key}
                        style={{
                          padding: "0.35rem 0.45rem",
                          verticalAlign: "top",
                        }}
                      >
                        {isFilterable ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                            <label
                              htmlFor={`filter-${key}`}
                              style={{
                                color: "var(--text-secondary)",
                                fontWeight: 500,
                                fontSize: "0.75rem",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical" as const,
                                overflow: "hidden",
                                lineHeight: "1.3",
                                minHeight: "1.3em",
                              }}
                            >
                              {column.label}
                            </label>
                            {column.filterType === "select" && column.selectOptions ? (
                              <select
                                id={`filter-${key}`}
                                value={filters[key] || ""}
                                onChange={(e) => handleFilterChange(key, e.target.value)}
                                style={{ ...filterControlStyle, cursor: "pointer" }}
                              >
                                <option value="">{labels.all}</option>
                                {column.selectOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : column.filterType === "date" ? (
                              <div style={{ display: "flex", gap: "0.2rem" }}>
                                <input
                                  id={`filter-${key}-from`}
                                  type="date"
                                  value={(filters[key] || "|").split("|")[0] || ""}
                                  onChange={(e) => {
                                    const parts = (filters[key] || "|").split("|");
                                    handleFilterChange(key, `${e.target.value}|${parts[1] || ""}`);
                                  }}
                                  style={{ ...filterControlStyle, width: "50%", fontSize: "0.7rem", padding: "0.2rem 0.3rem" }}
                                  title={locale === "fr" ? "Du" : "From"}
                                />
                                <input
                                  id={`filter-${key}-to`}
                                  type="date"
                                  value={(filters[key] || "|").split("|")[1] || ""}
                                  onChange={(e) => {
                                    const parts = (filters[key] || "|").split("|");
                                    handleFilterChange(key, `${parts[0] || ""}|${e.target.value}`);
                                  }}
                                  style={{ ...filterControlStyle, width: "50%", fontSize: "0.7rem", padding: "0.2rem 0.3rem" }}
                                  title={locale === "fr" ? "Au" : "To"}
                                />
                              </div>
                            ) : column.filterType === "number" ? (
                              <div style={{ display: "flex", gap: "0.2rem" }}>
                                <input
                                  id={`filter-${key}-min`}
                                  type="number"
                                  placeholder="Min"
                                  value={(filters[key] || "|").split("|")[0] || ""}
                                  onChange={(e) => {
                                    const parts = (filters[key] || "|").split("|");
                                    handleFilterChange(key, `${e.target.value}|${parts[1] || ""}`);
                                  }}
                                  style={{ ...filterControlStyle, width: "50%" }}
                                />
                                <input
                                  id={`filter-${key}-max`}
                                  type="number"
                                  placeholder="Max"
                                  value={(filters[key] || "|").split("|")[1] || ""}
                                  onChange={(e) => {
                                    const parts = (filters[key] || "|").split("|");
                                    handleFilterChange(key, `${parts[0] || ""}|${e.target.value}`);
                                  }}
                                  style={{ ...filterControlStyle, width: "50%" }}
                                />
                              </div>
                            ) : (
                              <input
                                id={`filter-${key}`}
                                type="text"
                                placeholder={labels.filter}
                                value={filters[key] || ""}
                                onChange={(e) => handleFilterChange(key, e.target.value)}
                                style={filterControlStyle}
                              />
                            )}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="admin-placeholder-card">
        <div className="admin-placeholder-title">{title}</div>
        {description && (
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.6rem" }}>
            {description}
          </p>
        )}

        <div
          style={{
            marginBottom: "0.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
          }}
        >
          <span>
            {totalRows} {labels.lines}
            {totalRows > 1 ? "s" : ""} ({labels.page} {currentPage}/{totalPages})
          </span>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            {labels.rowsPerPage}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{
                padding: "0.3rem 0.45rem",
                borderRadius: "0.4rem",
                border: "1px solid var(--border-color)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ overflowX: "auto" }} ref={dataTableWrapperRef}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.8rem",
              tableLayout: "fixed",
              minWidth: columns.length > 5 ? `${columns.length * 150}px` : undefined,
            }}
          >
            <colgroup>
              {columns.map((column) => (
                <col
                  key={String(column.key)}
                  style={{ width: getEffectiveColumnWidth(column) || "150px" }}
                />
              ))}
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                {columns.map((column) => {
                  const key = column.key;
                  const isSorted = sortKey === key;
                  const arrow = !isSorted
                    ? "↕"
                    : sortDirection === "asc"
                    ? "↑"
                    : "↓";
                  const sortLabel = !isSorted
                    ? labels.sortNone
                    : sortDirection === "asc"
                    ? labels.sortAsc
                    : labels.sortDesc;

                  return (
                    <th
                      key={String(column.key)}
                      ref={(element) => {
                        headerRefs.current[String(column.key)] = element;
                      }}
                      style={{
                        padding: "0.75rem",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSortChange(column.key)}
                        title={sortLabel}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          cursor: "pointer",
                          padding: 0,
                          font: "inherit",
                          maxWidth: "100%",
                        }}
                      >
                        <span style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical" as const,
                          overflow: "hidden",
                          lineHeight: "1.3",
                        }}>{column.label}</span>
                        <span style={{ opacity: isSorted ? 1 : 0.6, flexShrink: 0 }}>{arrow}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => (
                  <tr
                    key={item.id}
                    onClick={(event) => handleRowClick(event, item)}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      backgroundColor:
                        idx === 0 && currentPage === 1
                          ? "rgba(30,64,175,0.08)"
                          : "transparent",
                      cursor: onRowClick ? "pointer" : "default",
                    }}
                  >
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        style={{
                          padding: "0.75rem",
                          color: "var(--text-primary)",
                          whiteSpace: "normal",
                          overflowWrap: "break-word",
                          wordBreak: "normal",
                          verticalAlign: "top",
                        }}
                      >
                        {column.render
                          ? column.render(item)
                          : String(item[column.key])}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {labels.noResult}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div
            style={{
              marginTop: "0.85rem",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: "0.3rem 0.55rem",
                borderRadius: "0.4rem",
                border: "1px solid var(--border-color)",
                background: "var(--button-bg)",
                color: "var(--text-primary)",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                opacity: currentPage === 1 ? 0.6 : 1,
              }}
            >
              {labels.previous}
            </button>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: "0.3rem 0.55rem",
                borderRadius: "0.4rem",
                border: "1px solid var(--border-color)",
                background: "var(--button-bg)",
                color: "var(--text-primary)",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                opacity: currentPage === totalPages ? 0.6 : 1,
              }}
            >
              {labels.next}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
