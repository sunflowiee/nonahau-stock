"use client";

import { useMemo, useState } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WIB_TZ } from "@/lib/date";

type ExportScope = "all" | "month" | "range";

function getCurrentMonthValue() {
  return formatInTimeZone(new Date(), WIB_TZ, "yyyy-MM");
}

function getCurrentDateValue() {
  return formatInTimeZone(new Date(), WIB_TZ, "yyyy-MM-dd");
}

function getMonthDateRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    fromDate: `${monthValue}-01`,
    toDate: `${monthValue}-${String(lastDay).padStart(2, "0")}`,
  };
}

function toStartOfDayIso(dateValue: string) {
  return fromZonedTime(`${dateValue}T00:00:00`, WIB_TZ).toISOString();
}

function toEndOfDayIso(dateValue: string) {
  return fromZonedTime(`${dateValue}T23:59:59.999`, WIB_TZ).toISOString();
}

function buildExportHref({
  exportHref,
  scope,
  month,
  from,
  to,
}: {
  exportHref: string;
  scope: ExportScope;
  month: string;
  from: string;
  to: string;
}) {
  const [pathname, queryString = ""] = exportHref.split("?");
  const params = new URLSearchParams(queryString);

  params.delete("from");
  params.delete("to");

  if (scope === "month" && month) {
    const { fromDate, toDate } = getMonthDateRange(month);
    params.set("from", toStartOfDayIso(fromDate));
    params.set("to", toEndOfDayIso(toDate));
  }

  if (scope === "range" && from && to) {
    params.set("from", toStartOfDayIso(from));
    params.set("to", toEndOfDayIso(to));
  }

  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

function formatMonthLabel(monthValue: string) {
  if (!monthValue) return "bulan yang dipilih";

  const [year, month] = monthValue.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatDateLabel(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function MovementExportDialog({ exportHref }: { exportHref: string }) {
  const currentMonth = getCurrentMonthValue();
  const currentDate = getCurrentDateValue();

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>("all");
  const [month, setMonth] = useState(currentMonth);
  const [from, setFrom] = useState(`${currentMonth}-01`);
  const [to, setTo] = useState(currentDate);

  const isRangeValid = from <= to;
  const canExport =
    scope === "all" ||
    (scope === "month" ? Boolean(month) : Boolean(from) && Boolean(to) && isRangeValid);

  const downloadHref = useMemo(
    () =>
      buildExportHref({
        exportHref,
        scope,
        month,
        from,
        to,
      }),
    [exportHref, scope, month, from, to]
  );

  const summary = useMemo(() => {
    if (scope === "all") {
      return "Semua transaksi IN dan OUT akan diunduh.";
    }

    if (scope === "month") {
      return `Data transaksi untuk bulan ${formatMonthLabel(month)} akan diunduh (WIB).`;
    }

    if (!from || !to || !isRangeValid) {
      return "Pilih rentang tanggal yang valid untuk export.";
    }

    return `Data transaksi dari ${formatDateLabel(from)} sampai ${formatDateLabel(to)} akan diunduh (WIB).`;
  }, [scope, month, from, to, isRangeValid]);

  function handleExport() {
    if (!canExport) return;

    setOpen(false);
    window.location.assign(downloadHref);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger type="button" className={buttonVariants({ className: "h-9" })}>
        Export CSV
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export CSV</DialogTitle>
          <DialogDescription>
            Pilih cakupan waktu data yang ingin diunduh. Export ini tetap berisi transaksi IN dan OUT.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cakupan waktu</Label>
            <Select value={scope} onValueChange={(value) => setScope((value as ExportScope) ?? "all")}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Pilih cakupan waktu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua waktu</SelectItem>
                <SelectItem value="month">1 bulan tertentu</SelectItem>
                <SelectItem value="range">Rentang tanggal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "month" ? (
            <div className="space-y-2">
              <Label htmlFor="exportMonth">Bulan</Label>
              <Input
                id="exportMonth"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-9"
              />
            </div>
          ) : null}

          {scope === "range" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exportFrom">Dari tanggal</Label>
                <Input
                  id="exportFrom"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exportTo">Sampai tanggal</Label>
                <Input
                  id="exportTo"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {summary}
          </div>

          {scope === "range" && !isRangeValid ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Tanggal akhir harus sama atau setelah tanggal mulai.
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleExport} disabled={!canExport}>
            Unduh CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
