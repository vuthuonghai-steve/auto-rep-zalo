import { getAllFeatures } from '@/configs/features.config';
import {
  InMemoryFeatureStorageAdapter,
  flagsSignal,
  setDefaultStorageAdapterForTesting,
} from '@/configs/storage.config';
import { ARCHITECTURAL_LAYER_SECTIONS, MasterMenuScreen } from '@/screens/menu/MasterMenuScreen';
import { h, render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('MasterMenuScreen (Tasks 2.2 & 2.3: 5 Architectural Layers & Feature Nodes)', () => {
  let container: HTMLDivElement;
  let testStorage: InMemoryFeatureStorageAdapter;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    testStorage = new InMemoryFeatureStorageAdapter();
    setDefaultStorageAdapterForTesting(testStorage);

    // Initialize flagsSignal with default all true for testing
    const initialFlags: Record<string, boolean> = {};
    for (const f of getAllFeatures()) {
      initialFlags[f.id] = true;
    }
    flagsSignal.value = initialFlags;
  });

  afterEach(() => {
    setDefaultStorageAdapterForTesting(null);
  });

  it('should render all 5 architectural layer sections with their titles and badges', () => {
    render(h(MasterMenuScreen, {}), container);

    expect(container.textContent).toContain('Cấu Hình Cốt Lõi (Core & Whitelist)');
    expect(container.textContent).toContain('Tầng Quan Sát & Điều Phối');
    expect(container.textContent).toContain('Tầng Thu Thập & Gom Cụm');
    expect(container.textContent).toContain('Tầng Thẩm Định & Định Tuyến');
    expect(container.textContent).toContain('Tầng Tác Động Giao Diện & Hoàn Tất');

    for (const section of ARCHITECTURAL_LAYER_SECTIONS) {
      const sectionEl = container.querySelector(`[data-testid="layer-section-${section.id}"]`);
      expect(sectionEl).not.toBeNull();
      expect(sectionEl?.textContent).toContain(section.badgeLabel);
      expect(sectionEl?.textContent).toContain(section.roleNote);
    }
  });

  it('should group all 11 features into the correct architectural layers', () => {
    render(h(MasterMenuScreen, {}), container);

    // Layer 1: CORE
    const layer1 = container.querySelector('[data-testid="layer-section-layer-core"]');
    expect(layer1?.querySelector('[data-testid="feature-card-core-settings"]')).not.toBeNull();

    // Layer 2: OBSERVATION & ORCHESTRATION
    const layer2 = container.querySelector(
      '[data-testid="layer-section-layer-observation-orchestration"]',
    );
    expect(
      layer2?.querySelector('[data-testid="feature-card-n01-sidebar-observer"]'),
    ).not.toBeNull();
    expect(layer2?.querySelector('[data-testid="feature-card-n02-queue-manager"]')).not.toBeNull();

    // Layer 3: INGESTION
    const layer3 = container.querySelector('[data-testid="layer-section-layer-ingestion"]');
    expect(layer3?.querySelector('[data-testid="feature-card-n03-chat-switcher"]')).not.toBeNull();
    expect(layer3?.querySelector('[data-testid="feature-card-n04-delta-stitcher"]')).not.toBeNull();
    expect(
      layer3?.querySelector('[data-testid="feature-card-n05-bundle-aggregator"]'),
    ).not.toBeNull();

    // Layer 4: DECISION
    const layer4 = container.querySelector('[data-testid="layer-section-layer-decision"]');
    expect(layer4?.querySelector('[data-testid="feature-card-n06-dedup-gate"]')).not.toBeNull();
    expect(layer4?.querySelector('[data-testid="feature-card-n07-price-router"]')).not.toBeNull();

    // Layer 5: EXECUTION
    const layer5 = container.querySelector('[data-testid="layer-section-layer-execution"]');
    expect(
      layer5?.querySelector('[data-testid="feature-card-n08-forward-automator"]'),
    ).not.toBeNull();
    expect(layer5?.querySelector('[data-testid="feature-card-n09-text-injector"]')).not.toBeNull();
    expect(
      layer5?.querySelector('[data-testid="feature-card-n10-committer-drain"]'),
    ).not.toBeNull();
  });

  it('should filter features dynamically based on search query', async () => {
    render(h(MasterMenuScreen, {}), container);

    const searchInput = container.querySelector<HTMLInputElement>('[data-testid="search-input"]');
    expect(searchInput).not.toBeNull();

    // Filter by node code "N01"
    if (searchInput) {
      searchInput.value = 'N01';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 10));

    expect(
      container.querySelector('[data-testid="feature-card-n01-sidebar-observer"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="feature-card-n02-queue-manager"]')).toBeNull();
    expect(container.querySelector('[data-testid="feature-card-core-settings"]')).toBeNull();

    // Search non-existent
    if (searchInput) {
      searchInput.value = 'xyz-no-match-node';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 10));

    expect(container.querySelector('[data-testid="no-results-found"]')).not.toBeNull();
    expect(container.textContent).toContain('Không tìm thấy module nào khớp với từ khóa');
  });

  it('should support batch toggle all enable and disable', async () => {
    render(h(MasterMenuScreen, {}), container);

    const disableAllBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="toggle-all-disable"]',
    );
    expect(disableAllBtn).not.toBeNull();
    disableAllBtn?.click();

    // Check all flags in flagsSignal are now false
    const allFalse = Object.values(flagsSignal.value).every((v) => v === false);
    expect(allFalse).toBe(true);

    const enableAllBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="toggle-all-enable"]',
    );
    expect(enableAllBtn).not.toBeNull();
    enableAllBtn?.click();

    // Check all flags in flagsSignal are now true
    const allTrue = Object.values(flagsSignal.value).every((v) => v === true);
    expect(allTrue).toBe(true);
  });
});
