import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Megaphone,
  Plus,
  Rocket,
  Pause,
  Play,
  XCircle,
  Trash2,
  Users
} from "lucide-react";
import { adminApi } from "../api";
import type {
  Campaign,
  CampaignAllocation,
  CampaignFilters,
  CampaignSortMode,
  RegistryFilterOptions,
  UserSummary
} from "../../../types";
import { Card } from "../../../components/ui/card";
import { KPICard } from "../../../components/ui/kpi-card";
import { CustomSelect } from "../../../components/ui/custom-select";
import { CustomMultiSelect } from "../../../components/ui/custom-multi-select";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";
import { filterAddisSubcities, isAddisAbabaRegion } from "../../../lib/utils/addis-subcities";
import { getCachedFilterOptions, peekFilterOptionsCache } from "../../../lib/filter-options-cache";

/** Matches server campaign selection cap in registryService. */
const MAX_CAMPAIGN_LEADS = 500;

const SORT_OPTIONS: { value: CampaignSortMode; label: string }[] = [
  { value: "capital_desc", label: "Capital: high → low" },
  { value: "capital_asc", label: "Capital: low → high" },
  { value: "value_desc", label: "Score: high → low" },
  { value: "value_asc", label: "Score: low → high" },
  { value: "random", label: "Random sample" }
];

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-default text-muted",
  ACTIVE: "bg-success/15 text-success",
  PAUSED: "bg-warning/15 text-warning",
  CLOSED: "bg-danger/15 text-danger"
};

function formatCapital(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-ET", { maximumFractionDigits: 0 }).format(value);
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[status] || STATUS_TONE.DRAFT}`}>
      {status}
    </span>
  );
}

export function AdminCampaigns() {
  const { campaignId } = useParams();
  if (campaignId === "new") return <CampaignWizard />;
  if (campaignId) return <CampaignDetail campaignId={campaignId} />;
  return <CampaignList />;
}

function CampaignList() {
  const navigate = useNavigate();
  const { danger } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      setCampaigns(await adminApi.getCampaigns(status || undefined));
    } catch (err) {
      danger(getErrorMessage(err, "Failed to load campaigns"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Campaigns</h2>
          <p className="text-xs text-muted mt-1">
            Create a campaign, pick the leads you want, and assign them to your sales team.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/campaigns/new")}
          className="btn-interactive inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          New campaign
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {["", "ACTIVE", "DRAFT", "PAUSED", "CLOSED"].map((item) => (
          <button
            key={item || "ALL"}
            onClick={() => setStatus(item)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-bold ${
              status === item ? "bg-foreground text-background" : "bg-default/50 text-muted hover:text-foreground"
            }`}
          >
            {item || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-muted">Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-separator p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 text-sm font-semibold text-foreground">No campaigns yet</p>
          <p className="mt-1 text-xs text-muted">Create a campaign to hand-pick leads and assign them to your team.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((campaign) => (
            <button
              key={campaign.id}
              onClick={() => navigate(`/admin/campaigns/${campaign.id}`)}
              className="btn-interactive rounded-xl border border-separator bg-surface p-4 text-left shadow-surface hover:border-accent/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{campaign.name}</h3>
                    {campaign.label ? (
                      <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                        {campaign.label}
                      </span>
                    ) : null}
                    <StatusBadge status={campaign.status} />
                  </div>
                  {campaign.description ? <p className="mt-1 text-xs text-muted line-clamp-1">{campaign.description}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-foreground">{campaign.stats?.total ?? campaign._count?.leads ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted">leads</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                <span>{campaign.members?.length || 0} agents</span>
                <span>·</span>
                <span>{campaign.stats?.progressPct ?? 0}% worked</span>
                <span>·</span>
                <span>
                  {campaign.stats?.won ?? 0} won / {campaign.stats?.lost ?? 0} lost
                </span>
              </div>
              {campaign.stats && campaign.stats.total > 0 ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-default">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${campaign.stats.progressPct}%` }} />
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignWizard() {
  const navigate = useNavigate();
  const { success, danger } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<CampaignFilters>({});
  const [sortMode, setSortMode] = useState<CampaignSortMode>("capital_desc");
  const [salesUsers, setSalesUsers] = useState<UserSummary[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [durationDays, setDurationDays] = useState(14);
  const [batchLeadCount, setBatchLeadCount] = useState(20);
  const cachedCampaignOptions = peekFilterOptionsCache<RegistryFilterOptions>("admin:campaign-filter-options");
  const [options, setOptions] = useState<RegistryFilterOptions>(
    cachedCampaignOptions || {
      regions: [],
      subcities: [],
      sectors: [],
      nationalities: [],
      businessTypes: []
    }
  );
  const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(!cachedCampaignOptions);
  const [launching, setLaunching] = useState(false);
  const [poolSizeTarget, setPoolSizeTarget] = useState(100);
  const [preparingPool, setPreparingPool] = useState(false);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [preparedPoolSize, setPreparedPoolSize] = useState(0);
  const [poolSample, setPoolSample] = useState<
    Array<{ fullName: string; businessName: string; phoneNumber: string; capital: number; region: string; subcity: string }>
  >([]);

  const totalRequested = useMemo(
    () => Object.values(allocations).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [allocations]
  );
  const poolCap = preparedPoolSize > 0 ? preparedPoolSize : MAX_CAMPAIGN_LEADS;

  useEffect(() => {
    let cancelled = false;
    const hasCache = Boolean(peekFilterOptionsCache("admin:campaign-filter-options"));
    if (!hasCache) setIsFilterOptionsLoading(true);
    Promise.all([
      adminApi.getSalesUsers(),
      getCachedFilterOptions("admin:campaign-filter-options", () => adminApi.getCampaignFilterOptions())
    ])
      .then(([users, filterOptions]) => {
        if (cancelled) return;
        setSalesUsers(users);
        setOptions(filterOptions);
        setAllocations((prev) => {
          if (Object.keys(prev).length) return prev;
          const initial: Record<string, number> = {};
          users.forEach((u) => {
            initial[u.id] = 0;
          });
          return initial;
        });
      })
      .catch((err) => {
        if (!cancelled) danger(getErrorMessage(err, "Failed to load setup data"));
      })
      .finally(() => {
        if (!cancelled) setIsFilterOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [danger]);

  function setFilter<K extends keyof CampaignFilters>(key: K, value: CampaignFilters[K]) {
    setFilters((prev) => {
      const next = { ...prev };
      if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  function dailyGoalForLeads(leads: number) {
    if (leads <= 0) return 0;
    return Math.max(1, Math.ceil(leads / Math.max(1, durationDays)));
  }

  function clampLeadCount(value: number) {
    return Math.max(0, Math.min(poolCap, Math.floor(value) || 0));
  }

  /** Cap a per-agent count so total across agents never exceeds prepared pool. */
  function setAgentLeadCount(userId: string, raw: number) {
    const nextCount = clampLeadCount(raw);
    setAllocations((prev) => {
      const others = Object.entries(prev).reduce(
        (sum, [id, n]) => (id === userId ? sum : sum + (Number(n) || 0)),
        0
      );
      const allowed = Math.max(0, poolCap - others);
      return { ...prev, [userId]: Math.min(nextCount, allowed) };
    });
  }

  function setAllAgentLeadCounts(perAgent: number) {
    const n = salesUsers.length;
    if (!n) return;
    const each = clampLeadCount(perAgent);
    const total = each * n;
    if (total <= poolCap) {
      const next: Record<string, number> = {};
      salesUsers.forEach((u) => {
        next[u.id] = each;
      });
      setAllocations(next);
      return;
    }
    const base = Math.floor(poolCap / n);
    let remainder = poolCap % n;
    const next: Record<string, number> = {};
    salesUsers.forEach((u) => {
      next[u.id] = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
    });
    setAllocations(next);
  }

  function invalidatePreparedPool() {
    setPreparedPoolSize(0);
    setPoolSample([]);
  }

  async function preparePool(): Promise<boolean> {
    if (name.trim().length < 2) {
      danger("Campaign name is required (step 1)");
      return false;
    }
    const size = Math.max(1, Math.min(MAX_CAMPAIGN_LEADS, Math.floor(poolSizeTarget) || 0));
    if (!size) {
      danger("Set how many unique-phone leads to prepare");
      return false;
    }
    try {
      setPreparingPool(true);
      let campaignId = draftCampaignId;
      if (!campaignId) {
        const campaign = await adminApi.createCampaign({
          name: name.trim(),
          description: description.trim() || null,
          filters,
          sortMode,
          durationDays
        });
        campaignId = campaign.id;
        setDraftCampaignId(campaignId);
      }
      const result = await adminApi.prepareCampaignPool(campaignId, {
        filters,
        sortMode,
        poolSize: size
      });
      setPreparedPoolSize(result.poolSize);
      setPoolSample(result.sample || []);
      setAllocations((prev) => {
        const next: Record<string, number> = {};
        Object.keys(prev).forEach((id) => {
          next[id] = 0;
        });
        return next;
      });
      success(
        result.poolSize < size
          ? `Prepared ${result.poolSize} of ${size} unique-phone leads (pool exhausted)`
          : `Prepared ${result.poolSize} unique-phone leads`
      );
      return result.poolSize > 0;
    } catch (err) {
      danger(getErrorMessage(err, "Could not prepare lead pool"));
      return false;
    } finally {
      setPreparingPool(false);
    }
  }

  async function goToAssignStep() {
    if (preparingPool) return;
    // Re-prepare if filters changed or no pool yet
    if (preparedPoolSize < 1) {
      const ok = await preparePool();
      if (!ok) return;
    }
    setStep(3);
  }

  async function createAndLaunch(launch: boolean) {
    if (name.trim().length < 2) {
      danger("Campaign name is required");
      return;
    }
    const allocationList: CampaignAllocation[] = Object.entries(allocations)
      .filter(([, count]) => count > 0)
      .map(([userId, count]) => ({
        userId,
        count: clampLeadCount(count),
        dailyContactGoal: dailyGoalForLeads(clampLeadCount(count))
      }));

    const total = allocationList.reduce((sum, row) => sum + row.count, 0);
    if (total > poolCap) {
      danger(`Total assignments (${total}) exceed prepared pool (${poolCap})`);
      return;
    }

    if (launch && !allocationList.length) {
      danger("Assign at least one lead to a sales agent");
      return;
    }
    if (launch && preparedPoolSize < 1) {
      danger("Prepare a lead pool on the Filters step first");
      return;
    }

    try {
      setLaunching(true);
      let campaignId = draftCampaignId;
      if (!campaignId) {
        const campaign = await adminApi.createCampaign({
          name: name.trim(),
          description: description.trim() || null,
          filters,
          sortMode,
          durationDays,
          allocations: allocationList
        });
        campaignId = campaign.id;
        setDraftCampaignId(campaignId);
      }

      if (!launch) {
        success("Draft campaign saved");
        navigate(`/admin/campaigns/${campaignId}`);
        return;
      }

      const result = await adminApi.launchCampaign(campaignId, {
        filters,
        sortMode,
        allocations: allocationList
      });
      const summary = `Assigned ${result.results.assigned} of ${result.results.requested} leads`;
      if (result.results.assigned < result.results.requested) {
        success(result.message || summary);
      } else {
        success(summary);
      }
      navigate(`/admin/campaigns/${campaignId}`);
    } catch (err) {
      danger(getErrorMessage(err, "Could not create campaign"));
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/campaigns"
          className="btn-interactive inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">New campaign</h2>
          <p className="text-xs text-muted mt-0.5">
            Name it, prepare a unique-phone pool, assign agents, then launch
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            onClick={() => {
              if (n === 3) {
                void goToAssignStep();
                return;
              }
              setStep(n);
            }}
            disabled={preparingPool && n === 3}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${
              step === n ? "bg-accent text-accent-foreground" : "bg-default/50 text-muted"
            }`}
          >
            {n === 1 ? "1. Details" : n === 2 ? "2. Filters & pool" : "3. Assign"}
          </button>
        ))}
      </div>

      {step === 1 ? (
        <Card className="space-y-4 rounded-xl border border-separator p-5">
          <label className="block text-xs font-bold text-foreground">
            Campaign name *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 High-capital Addis"
              className="mt-1.5 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs"
            />
          </label>
          <label className="block text-xs font-bold text-foreground">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What this batch is for…"
              className="mt-1.5 w-full resize-none rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs"
            />
          </label>
          <div>
            <p className="mb-1.5 text-xs font-bold text-foreground">Campaign length</p>
            <div className="flex flex-wrap gap-2">
              {[
                { days: 7, label: "1 week" },
                { days: 14, label: "2 weeks" },
                { days: 30, label: "1 month" },
                { days: 60, label: "2 months" }
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setDurationDays(opt.days)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                    durationDays === opt.days
                      ? "bg-accent text-accent-foreground"
                      : "border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted">
                Custom
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 14)))}
                  className="w-16 rounded-lg border border-field-border bg-field-background px-2 py-1 text-center text-xs font-bold text-foreground"
                />
                days
              </label>
            </div>
          </div>
          <button
            onClick={() => setStep(2)}
            className="btn-interactive rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground"
          >
            Next: Filters
          </button>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="space-y-4 rounded-xl border border-separator p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs font-bold text-foreground">
              Min capital (ETB)
              <input
                type="number"
                value={filters.capitalMin ?? ""}
                onChange={(e) => {
                  invalidatePreparedPool();
                  setFilter("capitalMin", e.target.value ? Number(e.target.value) : undefined);
                }}
                placeholder="1000000"
                className="mt-1.5 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs"
              />
            </label>
            <label className="block text-xs font-bold text-foreground">
              Max capital (ETB)
              <input
                type="number"
                value={filters.capitalMax ?? ""}
                onChange={(e) => {
                  invalidatePreparedPool();
                  setFilter("capitalMax", e.target.value ? Number(e.target.value) : undefined);
                }}
                className="mt-1.5 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs"
              />
            </label>
            <div>
              <p className="mb-1.5 text-xs font-bold text-foreground">Sort</p>
              <CustomSelect
                value={sortMode}
                onChange={(v) => {
                  invalidatePreparedPool();
                  setSortMode(v as CampaignSortMode);
                }}
                options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                placeholder="Sort mode"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-foreground">Region</p>
              <CustomSelect
                value={filters.region || ""}
                onChange={(v) => {
                  invalidatePreparedPool();
                  setFilter("region", v || undefined);
                  if (!isAddisAbabaRegion(v)) setFilter("subcity", undefined);
                }}
                options={[{ value: "", label: "Any region" }, ...options.regions.map((r) => ({ value: r, label: r }))]}
                placeholder="Region"
                loading={isFilterOptionsLoading}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-foreground">Subcity</p>
              <CustomSelect
                value={filters.subcity || ""}
                onChange={(v) => {
                  invalidatePreparedPool();
                  setFilter("subcity", v || undefined);
                }}
                disabled={!isAddisAbabaRegion(filters.region)}
                options={[
                  {
                    value: "",
                    label: isAddisAbabaRegion(filters.region) ? "Any Addis subcity" : "Select Addis Ababa region first"
                  },
                  ...(isAddisAbabaRegion(filters.region)
                    ? filterAddisSubcities(options.subcities).map((r) => ({ value: r, label: r }))
                    : [])
                ]}
                placeholder="Subcity"
                loading={isFilterOptionsLoading}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-foreground">Sector</p>
              <CustomMultiSelect
                value={filters.sector || []}
                onChange={(v) => {
                  invalidatePreparedPool();
                  setFilter("sector", v);
                }}
                options={options.sectors.map((r) => ({ value: r, label: r }))}
                placeholder="Sector"
                emptyLabel="Any sector"
                loading={isFilterOptionsLoading}
                ariaLabel="Filter by sector"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-foreground">Business type</p>
              <CustomSelect
                value={filters.businessType || ""}
                onChange={(v) => {
                  invalidatePreparedPool();
                  setFilter("businessType", v || undefined);
                }}
                options={[
                  { value: "", label: "Any type" },
                  ...options.businessTypes.map((r) => ({ value: r, label: r }))
                ]}
                placeholder="Business type"
                loading={isFilterOptionsLoading}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-foreground">Nationality</p>
              <CustomSelect
                value={filters.nationality || ""}
                onChange={(v) => {
                  invalidatePreparedPool();
                  setFilter("nationality", v || undefined);
                }}
                options={[
                  { value: "", label: "Any nationality" },
                  ...options.nationalities.map((r) => ({ value: r, label: r }))
                ]}
                placeholder="Nationality"
                loading={isFilterOptionsLoading}
              />
            </div>
            <label className="block text-xs font-bold text-foreground">
              Pool size (unique phones)
              <input
                type="number"
                min={1}
                max={MAX_CAMPAIGN_LEADS}
                value={poolSizeTarget}
                onChange={(e) => {
                  invalidatePreparedPool();
                  setPoolSizeTarget(Math.max(1, Math.min(MAX_CAMPAIGN_LEADS, parseInt(e.target.value, 10) || 1)));
                }}
                className="mt-1.5 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs font-bold"
              />
              <span className="mt-1 block text-[10px] font-medium text-muted">
                Max {MAX_CAMPAIGN_LEADS}. System builds a list of unique phone numbers matching filters.
              </span>
            </label>
          </div>

          {preparingPool ? (
            <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-3 text-xs">
              <p className="font-bold text-accent">Preparing leads…</p>
              <p className="mt-1 text-[11px] text-muted">
                Building a list of up to {poolSizeTarget} unique phone numbers from the directory. This can take a
                minute on large filters.
              </p>
            </div>
          ) : preparedPoolSize > 0 ? (
            <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs">
              <p className="font-bold text-success">
                Pool ready: {preparedPoolSize} unique-phone lead{preparedPoolSize === 1 ? "" : "s"}
              </p>
              {poolSample.length > 0 ? (
                <p className="mt-1 text-[11px] text-muted">
                  Sample: {poolSample.slice(0, 3).map((s) => s.businessName || s.fullName).join(" · ")}
                  {poolSample.length > 3 ? "…" : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => goToAssignStep()}
              disabled={preparingPool}
              className="btn-interactive rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground disabled:opacity-40"
            >
              {preparingPool ? "Preparing leads…" : "Next: Assign team"}
            </button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="space-y-4 rounded-xl border border-separator p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Assign leads to sales</h3>
              <p className="text-[11px] text-muted">
                Divide the prepared pool ({preparedPoolSize} unique phones). Total cannot exceed pool size. Daily goals
                use campaign length ({durationDays} days).
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-field-border bg-field-background px-3 py-2 shadow-sm">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Leads per agent</p>
                <input
                  type="number"
                  min={0}
                  max={poolCap}
                  value={batchLeadCount}
                  onChange={(e) => setBatchLeadCount(clampLeadCount(parseInt(e.target.value, 10) || 0))}
                  className="mt-0.5 w-24 bg-transparent text-sm font-bold text-foreground focus:outline-none"
                  aria-label="Leads per agent"
                />
              </div>
              <button
                type="button"
                onClick={() => setAllAgentLeadCounts(batchLeadCount)}
                className="btn-interactive rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
              >
                Set all
              </button>
            </div>
          </div>

          {salesUsers.length === 0 ? (
            <p className="text-xs text-muted">No sales users yet. Add them under Team first.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_100px_100px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                <span>Agent</span>
                <span className="text-center">Leads</span>
                <span className="text-center">Daily goal</span>
              </div>
              {salesUsers.map((user) => {
                const leadCount = allocations[user.id] ?? 0;
                const dailyGoal = dailyGoalForLeads(leadCount);
                return (
                  <div
                    key={user.id}
                    className="grid grid-cols-[1fr_100px_100px] items-center gap-2 rounded-lg border border-separator bg-default/10 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                        {user.name.charAt(0)}
                      </div>
                      <span className="truncate text-xs font-semibold text-foreground">{user.name}</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={poolCap}
                      value={leadCount}
                      onChange={(e) => setAgentLeadCount(user.id, parseInt(e.target.value, 10) || 0)}
                      className="w-full rounded-lg border border-field-border bg-field-background px-2 py-1.5 text-center text-xs font-bold text-foreground"
                      aria-label={`${user.name} lead count`}
                    />
                    <div
                      className="rounded-lg border border-separator bg-surface px-2 py-1.5 text-center text-xs font-bold text-foreground"
                      title={`ceil(${leadCount} leads ÷ ${durationDays} days)`}
                      aria-label={`${user.name} daily contact goal`}
                    >
                      {dailyGoal}
                      <span className="ml-0.5 text-[10px] font-medium text-muted">/day</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-4">
            <p className="text-xs text-muted">
              Total requested:{" "}
              <span className={`font-bold ${totalRequested >= poolCap ? "text-warning" : "text-foreground"}`}>
                {totalRequested}
              </span>
              <span className="text-muted">
                {" "}
                / {poolCap} pool · over {durationDays} days
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => createAndLaunch(false)}
                disabled={launching}
                className="btn-interactive rounded-lg border border-border px-3 py-2 text-xs font-bold"
              >
                Save draft
              </button>
              <button
                onClick={() => createAndLaunch(true)}
                disabled={launching || totalRequested < 1}
                className="btn-interactive inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground disabled:opacity-40"
              >
                <Rocket className="h-3.5 w-3.5" />
                {launching ? "Launching…" : "Launch & assign"}
              </button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function CampaignDetail({ campaignId }: { campaignId: string }) {
  const navigate = useNavigate();
  const { success, danger } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setCampaign(await adminApi.getCampaign(campaignId));
    } catch (err) {
      danger(getErrorMessage(err, "Failed to load campaign"));
      navigate("/admin/campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function setStatus(status: "PAUSED" | "ACTIVE" | "CLOSED") {
    try {
      setBusy(true);
      const updated = await adminApi.updateCampaign(campaignId, { status });
      setCampaign((prev) => (prev ? { ...prev, ...updated, stats: prev.stats, leads: prev.leads } : updated));
      success(`Campaign ${status.toLowerCase()}`);
      await load();
    } catch (err) {
      danger(getErrorMessage(err, "Update failed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeDraft() {
    try {
      setBusy(true);
      await adminApi.deleteCampaign(campaignId);
      success("Draft deleted");
      navigate("/admin/campaigns");
    } catch (err) {
      danger(getErrorMessage(err, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  async function launchDraft() {
    if (!campaign) return;
    const allocations =
      campaign.members
        ?.filter((m) => m.targetCount > 0)
        .map((m) => ({
          userId: m.userId,
          count: m.targetCount,
          dailyContactGoal: m.dailyContactGoal || 0
        })) || [];
    if (!allocations.length) {
      danger("This draft has no agent allocations. Create a new campaign to set counts.");
      return;
    }
    try {
      setBusy(true);
      const result = await adminApi.launchCampaign(campaignId, {
        filters: (campaign.filters || {}) as CampaignFilters,
        sortMode: (campaign.sortMode as CampaignSortMode) || "capital_desc",
        allocations
      });
      const summary = `Assigned ${result.results.assigned} of ${result.results.requested} leads`;
      if (result.results.assigned < result.results.requested) {
        success(result.message || `${summary} — pool ran out of eligible phones`);
      } else {
        success(summary);
      }
      await load();
    } catch (err) {
      danger(getErrorMessage(err, "Launch failed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !campaign) {
    return <div className="py-16 text-center text-xs text-muted">Loading campaign…</div>;
  }

  const filters = (campaign.filters || {}) as CampaignFilters;
  const stats = campaign.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to="/admin/campaigns"
            className="btn-interactive mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">{campaign.name}</h2>
              {campaign.label ? (
                <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">{campaign.label}</span>
              ) : null}
              <StatusBadge status={campaign.status} />
            </div>
            {campaign.description ? <p className="mt-1 text-xs text-muted">{campaign.description}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.status === "ACTIVE" ? (
            <button
              disabled={busy}
              onClick={() => setStatus("PAUSED")}
              className="btn-interactive inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          ) : null}
          {campaign.status === "PAUSED" ? (
            <button
              disabled={busy}
              onClick={() => setStatus("ACTIVE")}
              className="btn-interactive inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
            >
              <Play className="h-3.5 w-3.5" /> Resume
            </button>
          ) : null}
          {campaign.status === "ACTIVE" || campaign.status === "PAUSED" ? (
            <button
              disabled={busy}
              onClick={() => setStatus("CLOSED")}
              className="btn-interactive inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-danger"
            >
              <XCircle className="h-3.5 w-3.5" /> Close
            </button>
          ) : null}
          {campaign.status === "DRAFT" ? (
            <>
              <button
                disabled={busy}
                onClick={launchDraft}
                className="btn-interactive inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
              >
                <Rocket className="h-3.5 w-3.5" /> Launch & assign
              </button>
              <button
                disabled={busy}
                onClick={removeDraft}
                className="btn-interactive inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard label="Total leads" value={stats?.total ?? 0} tone="accent" />
        <KPICard label="Still new" value={stats?.newCount ?? 0} />
        <KPICard label="In progress" value={(stats?.contacted ?? 0) + (stats?.followUp ?? 0)} tone="warning" />
        <KPICard label="Won" value={stats?.won ?? 0} tone="success" />
        <KPICard label="Lost" value={stats?.lost ?? 0} tone="danger" />
      </div>

      {stats && stats.total > 0 ? (
        <Card className="rounded-xl border border-separator p-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">Campaign progress</span>
            <span className="text-muted">{stats.progressPct}% worked</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-default">
            <div className="h-full rounded-full bg-accent" style={{ width: `${stats.progressPct}%` }} />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl border border-separator p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Selection filters</h3>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted">Capital min</dt>
              <dd className="font-semibold text-foreground">{filters.capitalMin != null ? formatCapital(filters.capitalMin) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Capital max</dt>
              <dd className="font-semibold text-foreground">{filters.capitalMax != null ? formatCapital(filters.capitalMax) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Region</dt>
              <dd className="font-semibold text-foreground">{filters.region || "Any"}</dd>
            </div>
            <div>
              <dt className="text-muted">Subcity</dt>
              <dd className="font-semibold text-foreground">{filters.subcity || "Any"}</dd>
            </div>
            <div>
              <dt className="text-muted">Sector</dt>
              <dd className="font-semibold text-foreground">
                {Array.isArray(filters.sector) && filters.sector.length
                  ? filters.sector.join(", ")
                  : typeof filters.sector === "string" && filters.sector
                    ? filters.sector
                    : "Any"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Sort</dt>
              <dd className="font-semibold text-foreground">{String(campaign.sortMode).replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-muted">Length</dt>
              <dd className="font-semibold text-foreground">{campaign.durationDays ?? 14} days</dd>
            </div>
            <div>
              <dt className="text-muted">Ends</dt>
              <dd className="font-semibold text-foreground">
                {campaign.endsAt ? new Date(campaign.endsAt).toLocaleDateString() : "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="rounded-xl border border-separator p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <Users className="h-3.5 w-3.5" /> Agent outcomes
          </h3>
          {!stats?.byAgent?.length ? (
            <p className="text-xs text-muted">No assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.byAgent.map((agent) => (
                <div key={agent.userId} className="rounded-lg border border-separator bg-default/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{agent.name}</span>
                    <span className="text-[11px] text-muted">{agent.total} leads</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted">
                    <span className="text-foreground">{agent.newCount} new</span>
                    <span>{agent.contacted + agent.followUp} working</span>
                    <span className="text-success">{agent.won} won</span>
                    <span className="text-danger">{agent.lost} lost</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden rounded-xl border border-separator">
        <div className="border-b border-separator bg-default/10 px-4 py-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Assigned leads</h3>
        </div>
        {!campaign.leads?.length ? (
          <p className="p-6 text-center text-xs text-muted">
            {campaign.status === "DRAFT" ? "Draft only — launch to assign leads." : "No leads on this campaign."}
          </p>
        ) : (
          <div className="max-h-[420px] overflow-auto" data-scrollbar="thin">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Lead</th>
                  <th className="px-3 py-2 font-semibold">Capital</th>
                  <th className="px-3 py-2 font-semibold">Agent</th>
                  <th className="px-3 py-2 font-semibold">Phase</th>
                  <th className="px-4 py-2 font-semibold">Region</th>
                </tr>
              </thead>
              <tbody>
                {campaign.leads.map((row) => (
                  <tr key={row.id} className="border-t border-separator/70">
                    <td className="px-4 py-2">
                      <p className="font-semibold text-foreground">{row.businessName || row.fullName}</p>
                      <p className="text-[11px] text-muted">{row.phoneNumber}</p>
                    </td>
                    <td className="px-3 py-2 text-foreground">{formatCapital(row.capital)}</td>
                    <td className="px-3 py-2 text-muted">{row.assignedTo?.name || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-md bg-default px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                        {row.lead?.phase || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted">{row.region || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
