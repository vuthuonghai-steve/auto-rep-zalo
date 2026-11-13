import { GlobalWindow } from 'happy-dom';

/**
 * Fixture: Node 01 Sidebar Observer DOM Snapshot
 * Replicated with 100% fidelity from Temps/zalo-element/sidebar.html
 * Meets 3-Tier Selector Fallbacks defined in src/contracts/selectors.ts
 */

export const ITEM_COMMUNITY_UNREAD_5_PLUS_HTML = `
<div class="msg-item " data-id="div_TabMsg_ThrdChItem" anim-data-id="g1206626154231863388" style="height: 78px; left: 0px; position: absolute; top: 0px; width: 100%;">
    <div class="gridv2 conv-item conv-rel lv-2 fluid tiny grid-fluid-8" style="gap: 0px; grid-template-columns: 60px auto 31px 23px;">
        <div class="flx flx-center conv-item__avatar grd-ava lv-2 grid-item">
            <div class="rel zavatar-container conversationList__avatar">
                <div class="zavatar zavatar-l zavatar-single flx flx-al-c flx-center rel disableDrag clickable zavatar-4">
                    <img alt="" draggable="false" src="https://ava-grp-talk.zadn.vn/8/9/3/8/2/360/2dc8873c255f5e7e19212d5421429d7a.jpg" data-ava-uid="g1206626154231863388" class="a-child">
                </div>
            </div>
        </div>
        <div class="conv-status grid-item"></div>
        <div-b16 class="conv-item-title__name truncate grid-item" classname="grid-item">
            <i class="fa fa-Community_16_Filled community__conv-indicator"></i>
            <div class="truncate">🏆TL21House🏆-&nbsp;NGUỒN&nbsp;&lt;4tr</div>
        </div-b16>
        <div class="conv-item-title__more rel grid-item" style="line-height: 21px; transition: none; overflow: visible;">
            <div class="flx flx-al-c" style="width: fit-content; opacity: 1;">
                <i class="fa fa-Notif_Off_24_Filled conv__mute"></i>
                <div class="flx flx-center"><span class="preview-time --b"><span>8 <span data-translate-inner="STR_MINS">phút</span></span></span></div>
            </div>
            <div id="conv-title-action" class="flx flx-al-c absolute" style="width: fit-content; top: 0px; right: 0px; opacity: 0; transition-delay: 0ms;">
                <div icon="More_24_Line" class="z--btn--v2 btn-tertiary-neutral small conv-action__menu-v2 --rounded icon-only conv-action__menu-v2" data-disabled="" data-translate-title="Thêm" title="Thêm"><i class="fa fa-More_24_Line pre"></i></div>
            </div>
        </div>
        <div class="conv-item-body flx flx-al-c truncate grid-item">
            <div class="conv-item-body__main truncate flx flx-al-c w100">
                <div class="conv__label" title="Công việc" style="color: rgb(255, 105, 5);"><i class="fa fa-icon-solid-label-filled"></i></div>
                <div class="z-conv-message --unread" style="font: 14px / 21px SegoeuiPc, &quot;Segoe UI&quot;, &quot;San Francisco&quot;, &quot;Helvetica Neue&quot;, Helvetica, &quot;Lucida Grande&quot;, Roboto, Ubuntu, Tahoma, &quot;Microsoft Sans Serif&quot;, Tahoma, Arial, sans-serif; letter-spacing: 0.2px;">
                    <div class="z-conv-message__preview-message" style="max-width: 202px;">
                        <span class="z-conv-message__preview-sender-name">Linh Nguyễn:&nbsp;</span>
                        <div class="inline"><span class="inline">https://drive.</span><span class="inline">...</span></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="conv-item-body__action hasOption grid-item">
            <div class="conv-action__unread-v2 flx flx-al-c">
                <div class="z-noti-badge --big --counter --noti-disable">
                    <i class="fa fa-5_Plus_24_Line z-noti-badge__content --big"></i>
                </div>
            </div>
        </div>
    </div>
</div>
`.trim();

export const ITEM_MUTED_RED_DOT_HTML = `
<div class="msg-item " data-id="div_TabMsg_ThrdChItem" anim-data-id="g7140739336053443835" style="height: 78px; left: 0px; position: absolute; top: 78px; width: 100%;">
    <div class="gridv2 conv-item conv-rel lv-2 fluid tiny grid-fluid-8" style="gap: 0px; grid-template-columns: 60px auto 24px 22px;">
        <div class="flx flx-center conv-item__avatar grd-ava lv-2 grid-item">
            <div class="rel zavatar-container conversationList__avatar">
                <div class="zavatar zavatar-l zavatar-single flx flx-al-c flx-center rel disableDrag clickable zavatar-4">
                    <img alt="" draggable="false" src="https://ava-grp-talk.zadn.vn/5/a/6/0/2/360/6de0b094f34121fde1da1131dc183db2.jpg" data-ava-uid="g7140739336053443835" class="a-child">
                </div>
            </div>
        </div>
        <div class="conv-status grid-item"></div>
        <div-b16 class="conv-item-title__name truncate grid-item" classname="grid-item">
            <div class="truncate">DNT&nbsp;Home&nbsp;Team&nbsp;Sales&nbsp;BTL</div>
        </div-b16>
        <div class="conv-item-title__more rel grid-item" style="overflow: visible; line-height: 21px; transition: none;">
            <div class="flx flx-al-c" style="width: fit-content; opacity: 1;">
                <i class="fa fa-Notif_Off_24_Filled conv__mute"></i>
                <div class="flx flx-center"><span class="preview-time --b"><span>2 <span data-translate-inner="STR_HOURS">giờ</span></span></span></div>
            </div>
            <div id="conv-title-action" class="flx flx-al-c absolute" style="width: fit-content; top: 0px; right: 0px; opacity: 0; transition-delay: 0ms;">
                <div icon="More_24_Line" class="z--btn--v2 btn-tertiary-neutral small conv-action__menu-v2 --rounded icon-only conv-action__menu-v2" data-disabled="" data-translate-title="Thêm" title="Thêm"><i class="fa fa-More_24_Line pre"></i></div>
            </div>
        </div>
        <div class="conv-item-body flx flx-al-c truncate grid-item">
            <div class="conv-item-body__main truncate flx flx-al-c w100">
                <div class="conv__label" title="Công việc" style="color: rgb(255, 105, 5);"><i class="fa fa-icon-solid-label-filled"></i></div>
                <div class="z-conv-message --unread" style="font: 14px / 21px SegoeuiPc, &quot;Segoe UI&quot;, &quot;San Francisco&quot;, &quot;Helvetica Neue&quot;, Helvetica, &quot;Lucida Grande&quot;, Roboto, Ubuntu, Tahoma, &quot;Microsoft Sans Serif&quot;, Tahoma, Arial, sans-serif; letter-spacing: 0.2px;">
                    <div class="z-conv-message__preview-message" style="max-width: 203px;">
                        <span class="z-conv-message__preview-icon" style="width: 16px; height: 16px; font-size: 16px; margin-right: 4px;"><i class="fa fa-icon-outline-reminder"></i></span>
                        <div class="inline"><span class="inline">7h sáng khách đi xem phòng</span></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="conv-item-body__action hasOption grid-item">
            <div class="conv-action__unread-v2 flx flx-al-c">
                <div class="z-noti-badge --big --dot --noti-disable"></div>
            </div>
        </div>
    </div>
</div>
`.trim();

export const ITEM_READ_NO_BADGE_HTML = `
<div class="msg-item " data-id="div_TabMsg_ThrdChItem" anim-data-id="g2837343595483099522" style="height: 78px; left: 0px; position: absolute; top: 156px; width: 100%;">
    <div class="gridv2 conv-item conv-rel lv-2 fluid tiny grid-fluid-8" style="gap: 0px; grid-template-columns: 60px auto 28px 22px;">
        <div class="flx flx-center conv-item__avatar grd-ava lv-2 grid-item">
            <div class="rel zavatar-container conversationList__avatar">
                <div class="zavatar zavatar-l zavatar-single flx flx-al-c flx-center rel disableDrag clickable zavatar-4">
                    <img alt="" draggable="false" src="https://ava-grp-talk.zadn.vn/f/0/a/8/4/360/976170eaebd823e1f0cca0729fb2a0f7.jpg" data-ava-uid="g2837343595483099522" class="a-child">
                </div>
            </div>
        </div>
        <div class="conv-status grid-item"></div>
        <div-16 class="conv-item-title__name truncate grid-item" classname="grid-item">
            <div class="truncate">Dan&nbsp;Home&nbsp;Cầu&nbsp;Giấy&nbsp;cao&nbsp;cấp</div>
        </div-16>
        <div class="conv-item-title__more rel grid-item" style="line-height: 21px; transition: none; overflow: visible;">
            <div class="flx flx-al-c" style="width: fit-content; opacity: 1;">
                <i class="fa fa-Notif_Off_24_Filled conv__mute"></i>
                <div class="flx flx-center"><span class="preview-time"><span>10 <span data-translate-inner="STR_HOURS">giờ</span></span></span></div>
            </div>
            <div id="conv-title-action" class="flx flx-al-c absolute" style="width: fit-content; top: 0px; right: 0px; opacity: 0; transition-delay: 0ms;">
                <div icon="More_24_Line" class="z--btn--v2 btn-tertiary-neutral small conv-action__menu-v2 --rounded icon-only conv-action__menu-v2" data-disabled="" data-translate-title="Thêm" title="Thêm"><i class="fa fa-More_24_Line pre"></i></div>
            </div>
        </div>
        <div class="conv-item-body flx flx-al-c truncate span-all grid-item">
            <div class="conv-item-body__main truncate flx flx-al-c w100">
                <div class="conv__label" title="Công việc" style="color: rgb(255, 105, 5);"><i class="fa fa-icon-solid-label-filled"></i></div>
                <div class="z-conv-message" style="font: 14px / 21px SegoeuiPc, &quot;Segoe UI&quot;, &quot;San Francisco&quot;, &quot;Helvetica Neue&quot;, Helvetica, &quot;Lucida Grande&quot;, Roboto, Ubuntu, Tahoma, &quot;Microsoft Sans Serif&quot;, Tahoma, Arial, sans-serif; letter-spacing: 0.2px;">
                    <div class="z-conv-message__preview-message" style="max-width: 225px;">
                        <span class="z-conv-message__preview-sender-name">Bạn:&nbsp;</span>
                        <div class="inline"><span class="inline">===================</span><span class="inline">...</span></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`.trim();

export const ITEM_DIRECT_READ_NO_BADGE_HTML = `
<div class="msg-item " data-id="div_TabMsg_ThrdChItem" anim-data-id="6123661134470420761" style="height: 78px; left: 0px; position: absolute; top: 234px; width: 100%;">
    <div class="gridv2 conv-item conv-rel lv-2 fluid tiny grid-fluid-8" style="gap: 0px; grid-template-columns: 60px auto 5px 22px;">
        <div class="flx flx-center conv-item__avatar grd-ava lv-2 grid-item">
            <div class="rel zavatar-container conversationList__avatar">
                <span title="" class="avatar-emoji-status zavatar__avatar-emoji-status" style="right: -8px; top: 2px; width: 28px; height: 28px;"></span>
                <div class="zavatar zavatar-l zavatar-single flx flx-al-c flx-center rel disableDrag clickable">
                    <img alt="" draggable="false" src="https://res-zalo.zadn.vn/zds/v1.0.158/zds_cic_my_documents_container_56.png" data-ava-uid="6123661134470420761" class="a-child">
                </div>
            </div>
        </div>
        <div class="conv-status grid-item"></div>
        <div-16 class="conv-item-title__name truncate grid-item" classname="grid-item">
            <div class="truncate">My&nbsp;Documents</div>
        </div-16>
        <div class="conv-item-title__more rel grid-item" style="line-height: 21px; transition: none; overflow: visible;">
            <div class="flx flx-al-c" style="width: fit-content; opacity: 1;">
                <div class="flx flx-center"><span class="preview-time"><span>9 <span data-translate-inner="STR_HOURS">giờ</span></span></span></div>
            </div>
            <div id="conv-title-action" class="flx flx-al-c absolute" style="width: fit-content; top: 0px; right: 0px; opacity: 0; transition-delay: 0ms;">
                <div icon="More_24_Line" class="z--btn--v2 btn-tertiary-neutral small conv-action__menu-v2 --rounded icon-only conv-action__menu-v2" data-disabled="" data-translate-title="Thêm" title="Thêm"><i class="fa fa-More_24_Line pre"></i></div>
            </div>
        </div>
        <div class="conv-item-body flx flx-al-c truncate span-all grid-item">
            <div class="conv-item-body__main truncate flx flx-al-c w100">
                <div class="z-conv-message" style="font: 14px / 21px SegoeuiPc, &quot;Segoe UI&quot;, &quot;San Francisco&quot;, &quot;Helvetica Neue&quot;, Helvetica, &quot;Lucida Grande&quot;, Roboto, Ubuntu, Tahoma, &quot;Microsoft Sans Serif&quot;, Tahoma, Arial, sans-serif; letter-spacing: 0.2px;">
                    <div class="z-conv-message__preview-message" style="max-width: 246px;">
                        <span class="z-conv-message__preview-sender-name">Bạn:&nbsp;</span>
                        <div class="inline"><span class="inline">=====================</span><span class="inline">...</span></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`.trim();

export const DEFAULT_SIDEBAR_ITEMS_HTML = `
${ITEM_COMMUNITY_UNREAD_5_PLUS_HTML}
${ITEM_MUTED_RED_DOT_HTML}
${ITEM_READ_NO_BADGE_HTML}
${ITEM_DIRECT_READ_NO_BADGE_HTML}
`.trim();

export function getSidebarDomHtml(customItemsHtml?: string): string {
  const items = customItemsHtml !== undefined ? customItemsHtml : DEFAULT_SIDEBAR_ITEMS_HTML;
  return `
<div id="conversationListId" class="w100 h100 web" data-id="div_TabMsg_ThrdChList" tabindex="999" style="position: relative; display: block; flex: 2 1 0%;">
    <div style="overflow: visible; height: 0px; width: 0px;">
        <div class="virtualized-scroll" style="position: relative; overflow: hidden; width: 344px; height: 821px;">
            <div style="position: absolute; inset: 0px; overflow: scroll; margin-right: -7px; margin-bottom: -7px;">
                <div aria-label="grid" class="ReactVirtualized__Grid ReactVirtualized__List" id="conversationList" role="grid" tabindex="-2" style="box-sizing: border-box; direction: ltr; height: 4928px; position: absolute; width: 344px; will-change: transform;">
                    <div class="ReactVirtualized__Grid__innerScrollContainer" style="width: auto; height: 4836px; max-width: 344px; max-height: 4836px; overflow: hidden; position: relative;">
                        ${items}
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`.trim();
}

export const SIDEBAR_DOM_HTML = getSidebarDomHtml();

export const SIDEBAR_FIXTURE_METADATA = {
  communityGroup: {
    groupId: 'g1206626154231863388',
    groupName: '🏆TL21House🏆- NGUỒN <4tr',
    rawName: '🏆TL21House🏆-&nbsp;NGUỒN&nbsp;&lt;4tr',
    isCommunity: true,
    unreadBadgeClass: 'fa-5_Plus_24_Line',
    expectedUnreadCount: 5,
    isDotBadge: false,
    previewSender: 'Linh Nguyễn:',
    previewSnippet: 'https://drive....',
  },
  mutedGroup: {
    groupId: 'g7140739336053443835',
    groupName: 'DNT Home Team Sales BTL',
    rawName: 'DNT&nbsp;Home&nbsp;Team&nbsp;Sales&nbsp;BTL',
    isCommunity: false,
    isMuted: true,
    unreadBadgeClass: '--dot',
    expectedUnreadCount: 1,
    isDotBadge: true,
    previewSender: '',
    previewSnippet: '7h sáng khách đi xem phòng',
  },
  readGroup: {
    groupId: 'g2837343595483099522',
    groupName: 'Dan Home Cầu Giấy cao cấp',
    rawName: 'Dan&nbsp;Home&nbsp;Cầu&nbsp;Giấy&nbsp;cao&nbsp;cấp',
    isCommunity: false,
    isMuted: true,
    unreadBadgeClass: null,
    expectedUnreadCount: 0,
    isDotBadge: false,
    previewSender: 'Bạn:',
    previewSnippet: '===================...',
  },
  directChat: {
    groupId: '6123661134470420761',
    groupName: 'My Documents',
    rawName: 'My&nbsp;Documents',
    isCommunity: false,
    isPersonal: true,
    unreadBadgeClass: null,
    expectedUnreadCount: 0,
    isDotBadge: false,
    previewSender: 'Bạn:',
    previewSnippet: '=====================...',
  },
} as const;

export interface CreateMockSidebarOptions {
  customItemsHtml?: string;
  attachToDocument?: boolean;
}

/**
 * Tạo một HTMLElement đại diện cho sidebar Zalo Web phục vụ testing offline.
 * Tương thích cả Vitest (Happy-DOM / JSDOM) và Bun Test.
 */
export function createMockSidebarDOM(options: CreateMockSidebarOptions = {}): HTMLElement {
  const { customItemsHtml, attachToDocument = false } = options;

  let doc: Document;
  if (typeof document !== 'undefined') {
    doc = document;
  } else {
    const happyWin = new GlobalWindow();
    // @ts-expect-error happy-dom Window type compatibility
    globalThis.window = happyWin;
    // @ts-expect-error happy-dom Document type compatibility
    globalThis.document = happyWin.document;
    // @ts-expect-error happy-dom HTMLElement type compatibility
    globalThis.HTMLElement = happyWin.HTMLElement;
    doc = happyWin.document as unknown as Document;
  }

  const wrapper = doc.createElement('div');
  wrapper.innerHTML = getSidebarDomHtml(customItemsHtml).trim();
  const sidebarElement = wrapper.firstElementChild as HTMLElement;

  if (attachToDocument && doc.body) {
    doc.body.appendChild(sidebarElement);
  }

  return sidebarElement;
}
