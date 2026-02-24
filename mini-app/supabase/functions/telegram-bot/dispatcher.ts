// Central dispatcher
import { tgSend, tgEdit, tgAnswer, tgDeleteMsg, TG, BOT_TOKEN } from "./lib/tg.ts";
import { type BotUser, getUser } from "./lib/db.ts";
import { getSession, saveSession, clearSession } from "./lib/session.ts";
import { detectPrimaryRole } from "./lib/roles.ts";
import { screenUnknownUser } from "./unknown.ts";

// Screens
import { setRouteToMenu, screenProjectsList, selectProject, screenAlerts, screenSupply, screenDashboard, screenFacades, screenFacadeDetail, screenApprovals, handleApproval, screenTasks, screenSettings, toggleNotification, screenDailyLogs, screenInbox, screenInboxDetail, handleInboxDone, screenProgress } from "./screens/shared.ts";
import { screenDirectorMenu, screenPortfolio, screenKPI, screenCritical, screenFinance } from "./screens/director.ts";
import { screenPMMenu, screenPMSend, screenPMSendLaunch, screenPMSendDesign, screenPMSendSupply, screenPMSendProd, screenPMQuick } from "./screens/pm.ts";
import { screenOPRMenu, screenOPRSend } from "./screens/opr.ts";
import { screenKMMenu, screenKMSend } from "./screens/km.ts";
import { screenKMDMenu, screenKMDSend } from "./screens/kmd.ts";
import { screenSupplyMenu, screenSupplySend, screenSupplyStatus, screenSupplyDeficit } from "./screens/supply.ts";
import { screenProductionMenu, screenProductionSend, screenProductionLoad } from "./screens/production.ts";
import { screenForemanMenu, screenForemanSend, screenForemanPhoto, screenForemanProgress } from "./screens/foreman.ts";
import { screenPTOMenu, screenPTOSend, screenPTORegistry } from "./screens/pto.ts";
import { screenInspectorMenu, screenInspectorSend, screenInspectorAccept, screenInspectorHistory, handleInspectorDecision } from "./screens/inspector.ts";
import { screenGenericMenu } from "./screens/generic.ts";

// FSM
import { DOC_FSM_MAP, startDocFSM, handleDocFile, handleDocComment, handleDocConfirm } from "./fsm/document.ts";
import { startPhotoFSM, screenPhotoFloor, screenPhotoUpload, handlePhotoFile, screenPhotoComment, handlePhotoComment, handlePhotoConfirm } from "./fsm/photo.ts";
import { screenForemanReportFacade, screenForemanReportFloor, screenForemanReportInput, screenForemanReportConfirm, saveForemanReport } from "./fsm/report.ts";
import { screenAlertNew, screenAlertTitle, saveAlert } from "./fsm/alert.ts";
import { screenLogZone, screenLogWorks, screenLogWorkers, saveLogEntry } from "./fsm/daily-log.ts";

// Route to correct menu by role
function routeToMenu(chatId: number, user: BotUser, session: any) {
  const primary = detectPrimaryRole(user.roles);
  switch (primary) {
    case "director": return screenDirectorMenu(chatId, user, session);
    case "pm": return screenPMMenu(chatId, user, session);
    case "project_opr": return screenOPRMenu(chatId, user, session);
    case "project_km": return screenKMMenu(chatId, user, session);
    case "project_kmd": return screenKMDMenu(chatId, user, session);
    case "supply": return screenSupplyMenu(chatId, user, session);
    case "production": return screenProductionMenu(chatId, user, session);
    case "foreman1": case "foreman2": case "foreman3": return screenForemanMenu(chatId, user, session);
    case "pto": return screenPTOMenu(chatId, user, session);
    case "inspector": return screenInspectorMenu(chatId, user, session);
    default: return screenGenericMenu(chatId, user, session);
  }
}

// Wire up shared screens' routeToMenu reference
setRouteToMenu(routeToMenu);

export async function handleUpdate(update: any) {
  // ── File uploads (for doc/photo FSM) ──
  if (update.message && (update.message.document || update.message.photo)) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const user = await getUser(chatId);
    if (!user) return;
    const session = await getSession(chatId);
    if (!session || (session.state !== "DOC_UPLOAD" && session.state !== "PHOTO_UPLOAD")) return;
    await tgDeleteMsg(chatId, msg.message_id);
    let fileId: string;
    if (msg.document) { fileId = msg.document.file_id; }
    else { fileId = msg.photo[msg.photo.length - 1].file_id; }
    const fileRes = await fetch(`${TG}/getFile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: fileId }) });
    const fileData = await fileRes.json();
    const fileUrl = fileData.ok ? `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}` : null;
    if (session.state === "PHOTO_UPLOAD") return handlePhotoFile(chatId, user, session, fileUrl || "file_received");
    return handleDocFile(chatId, user, session, fileUrl || "file_received");
  }

  // ── Text messages ──
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text: string = msg.text || "";
    const firstName = msg.from?.first_name || "Пользователь";
    if (msg.voice) { await tgSend(chatId, "🎤 Голосовые доступны в Mini App."); return; }
    const user = await getUser(chatId);
    const session = user ? await getSession(chatId) : null;

    if (text.startsWith("/start") || text.startsWith("/menu")) {
      if (!user) { await screenUnknownUser(chatId, firstName); return; }
      await tgDeleteMsg(chatId, msg.message_id);
      if (session?.message_id) await tgDeleteMsg(chatId, session.message_id);
      await clearSession(chatId);
      return routeToMenu(chatId, user, null);
    }
    if (text.startsWith("/help")) {
      await tgDeleteMsg(chatId, msg.message_id);
      const SEP = "─".repeat(29);
      await tgSend(chatId, `ℹ️ <b>STSphera Bot v4</b>\n${SEP}\n/start — главное меню\n/projects — проекты\n/settings — настройки`);
      return;
    }
    if (text.startsWith("/projects")) { if (!user) { await screenUnknownUser(chatId, firstName); return; } await tgDeleteMsg(chatId, msg.message_id); return screenProjectsList(chatId, user, session); }
    if (text.startsWith("/settings")) { if (!user) { await screenUnknownUser(chatId, firstName); return; } await tgDeleteMsg(chatId, msg.message_id); return screenSettings(chatId, user, session); }

    // FSM text inputs
    if (user && session && session.state !== "IDLE") {
      await tgDeleteMsg(chatId, msg.message_id);
      if (session.state === "REPORT_INPUT") {
        const num = parseFloat(text.replace(",", "."));
        if (isNaN(num) || num <= 0 || num > 1000) { await tgEdit(chatId, session.message_id!, "⚠️ Введите число от 1 до 1000:"); return; }
        return screenForemanReportConfirm(chatId, user, session, num);
      }
      if (session.state === "ALERT_TITLE") {
        const trimmed = text.trim().slice(0, 200);
        if (trimmed.length < 3) { await tgEdit(chatId, session.message_id!, "⚠️ Заголовок слишком короткий:"); return; }
        return saveAlert(chatId, user, session, trimmed);
      }
      if (session.state === "LOG_ZONE") {
        const zone = text.trim().slice(0, 100);
        if (zone.length < 2) { await tgEdit(chatId, session.message_id!, "⚠️ Слишком короткое:"); return; }
        const s = { ...session, context: { ...session.context, log_zone: zone } };
        await saveSession(chatId, user.user_id, "LOG_WORKS", s.context, session.message_id ?? undefined);
        return screenLogWorks(chatId, user, s);
      }
      if (session.state === "LOG_WORKS") {
        const works = text.trim().slice(0, 500);
        if (works.length < 5) { await tgEdit(chatId, session.message_id!, "⚠️ Опишите подробнее:"); return; }
        const s = { ...session, context: { ...session.context, log_works: works } };
        await saveSession(chatId, user.user_id, "LOG_WORKERS", s.context, session.message_id ?? undefined);
        return screenLogWorkers(chatId, user, s);
      }
      if (session.state === "DOC_COMMENT") return handleDocComment(chatId, user, session, text.trim());
      if (session.state === "PHOTO_COMMENT") return handlePhotoComment(chatId, user, session, text.trim());
    }
  }

  // ── Callback queries ──
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.from.id;
    const data: string = cq.data || "";
    await tgAnswer(cq.id);
    const user = await getUser(chatId);
    if (!user) { await screenUnknownUser(chatId, cq.from.first_name || ""); return; }
    const session = await getSession(chatId);
    if (!session) return routeToMenu(chatId, user, null);

    // Doc FSM
    if (DOC_FSM_MAP[data]) { const { label, recipients } = DOC_FSM_MAP[data]; return startDocFSM(chatId, user, session, data, label, recipients); }
    if (data === "doc:nocomment") return handleDocComment(chatId, user, session, "—");
    if (data === "doc:confirm") return handleDocConfirm(chatId, user, session);

    // Inbox
    if (data.startsWith("inbox:view:")) return screenInboxDetail(chatId, user, session, data.slice(11));
    if (data.startsWith("inbox:done:")) return handleInboxDone(chatId, user, session, data.slice(11));

    // Projects
    if (data === "proj:list") return screenProjectsList(chatId, user, session);
    if (data.startsWith("proj:sel:")) return selectProject(chatId, user, session, data.slice(9));

    // Common
    if (data === "c:settings") return screenSettings(chatId, user, session);
    if (data.startsWith("set:t:")) return toggleNotification(chatId, user, session, data.slice(6));

    // Approvals
    if (data.startsWith("appr:yes:")) return handleApproval(chatId, user, session, data.slice(9), "approved");
    if (data.startsWith("appr:no:")) return handleApproval(chatId, user, session, data.slice(8), "rejected");

    // Alert creation
    if (data.startsWith("at:")) return screenAlertTitle(chatId, user, session, data.slice(3));

    // Daily logs
    if (data === "log:new") return screenLogZone(chatId, user, session);
    if (data.startsWith("log:w:")) return saveLogEntry(chatId, user, session, parseInt(data.slice(6)));

    // Director
    if (data === "d:menu") return screenDirectorMenu(chatId, user, session);
    if (data === "d:portfolio") return screenPortfolio(chatId, user, session);
    if (data === "d:kpi") return screenKPI(chatId, user, session);
    if (data === "d:critical") return screenCritical(chatId, user, session);
    if (data === "d:finance") return screenFinance(chatId, user, session);
    if (data === "d:dash") return screenDashboard(chatId, user, session);
    if (data === "d:alerts") return screenAlerts(chatId, user, session);
    if (data === "d:supply") return screenSupply(chatId, user, session);
    if (data === "d:facades") return screenFacades(chatId, user, session);
    if (data === "d:approvals") return screenApprovals(chatId, user, session);
    if (data === "d:logs") return screenDailyLogs(chatId, user, session);
    if (data === "d:alert_new") return screenAlertNew(chatId, user, session);
    if (data === "d:inbox") return screenInbox(chatId, user, session, "director", "d");
    if (data.startsWith("d:fcd:")) return screenFacadeDetail(chatId, user, session, data.slice(6));

    // PM
    if (data === "pm:menu") return screenPMMenu(chatId, user, session);
    if (data === "pm:inbox") return screenInbox(chatId, user, session, "pm", "pm");
    if (data === "pm:send") return screenPMSend(chatId, user, session);
    if (data === "pm:s:launch") return screenPMSendLaunch(chatId, user, session);
    if (data === "pm:s:design") return screenPMSendDesign(chatId, user, session);
    if (data === "pm:s:supply") return screenPMSendSupply(chatId, user, session);
    if (data === "pm:s:prod") return screenPMSendProd(chatId, user, session);
    if (data === "pm:quick") return screenPMQuick(chatId, user, session);
    if (data === "pm:dash") return screenDashboard(chatId, user, session);
    if (data === "pm:alerts") return screenAlerts(chatId, user, session);
    if (data === "pm:tasks") return screenTasks(chatId, user, session);
    if (data === "pm:approvals") return screenApprovals(chatId, user, session);
    if (data === "pm:logs") return screenDailyLogs(chatId, user, session);
    if (data === "pm:alert_new") return screenAlertNew(chatId, user, session);

    // OPR
    if (data === "opr:menu") return screenOPRMenu(chatId, user, session);
    if (data === "opr:inbox") return screenInbox(chatId, user, session, "project_opr", "opr");
    if (data === "opr:send") return screenOPRSend(chatId, user, session);
    if (data === "opr:progress") return screenProgress(chatId, user, session, "opr");

    // KM
    if (data === "km:menu") return screenKMMenu(chatId, user, session);
    if (data === "km:inbox") return screenInbox(chatId, user, session, "project_km", "km");
    if (data === "km:send") return screenKMSend(chatId, user, session);
    if (data === "km:progress") return screenProgress(chatId, user, session, "km");

    // KMD
    if (data === "kmd:menu") return screenKMDMenu(chatId, user, session);
    if (data === "kmd:inbox") return screenInbox(chatId, user, session, "project_kmd", "kmd");
    if (data === "kmd:send") return screenKMDSend(chatId, user, session);
    if (data === "kmd:progress") return screenProgress(chatId, user, session, "kmd");

    // Supply
    if (data === "sup:menu") return screenSupplyMenu(chatId, user, session);
    if (data === "sup:inbox") return screenInbox(chatId, user, session, "supply", "sup");
    if (data === "sup:send") return screenSupplySend(chatId, user, session);
    if (data === "sup:status") return screenSupplyStatus(chatId, user, session);
    if (data === "sup:deficit") return screenSupplyDeficit(chatId, user, session);

    // Production
    if (data === "prod:menu") return screenProductionMenu(chatId, user, session);
    if (data === "prod:inbox") return screenInbox(chatId, user, session, "production", "prod");
    if (data === "prod:send") return screenProductionSend(chatId, user, session);
    if (data === "prod:load") return screenProductionLoad(chatId, user, session);

    // Foreman — BUG-005 fix: use detectPrimaryRole for inbox
    if (data === "f:menu") return screenForemanMenu(chatId, user, session);
    if (data === "f:inbox") return screenInbox(chatId, user, session, ["foreman", "foreman1", "foreman2", "foreman3"], "f");
    if (data === "f:send") return screenForemanSend(chatId, user, session);
    if (data === "f:report") return screenForemanReportFacade(chatId, user, session);
    if (data === "f:photo") return screenForemanPhoto(chatId, user, session);
    if (data === "f:progress") return screenForemanProgress(chatId, user, session);
    if (data === "f:alerts") return screenAlerts(chatId, user, session);
    if (data === "f:tasks") return screenTasks(chatId, user, session);
    if (data === "f:logs") return screenDailyLogs(chatId, user, session);
    if (data === "f:facades") return screenFacades(chatId, user, session);
    if (data.startsWith("f:rf:")) return screenForemanReportFloor(chatId, user, session, data.slice(5));
    if (data.startsWith("f:rfl:")) return screenForemanReportInput(chatId, user, session, data.slice(6));
    if (data.startsWith("f:rv:")) return screenForemanReportConfirm(chatId, user, session, parseInt(data.slice(5)));
    if (data.startsWith("f:rs:")) return saveForemanReport(chatId, user, session, parseInt(data.slice(5)));
    if (data.startsWith("f:fcd:")) return screenFacadeDetail(chatId, user, session, data.slice(6));
    if (data.startsWith("f:pt:")) return startPhotoFSM(chatId, user, session, data.slice(5));
    if (data.startsWith("f:pf:")) return screenPhotoFloor(chatId, user, session, data.slice(5));
    if (data.startsWith("f:pfl:")) return screenPhotoUpload(chatId, user, session, data.slice(6));
    if (data === "f:pc:done") return screenPhotoComment(chatId, user, session);
    if (data === "f:pc:skip") return handlePhotoComment(chatId, user, session, null);
    if (data === "f:pc:confirm") return handlePhotoConfirm(chatId, user, session);

    // PTO
    if (data === "pto:menu") return screenPTOMenu(chatId, user, session);
    if (data === "pto:inbox") return screenInbox(chatId, user, session, "pto", "pto");
    if (data === "pto:send") return screenPTOSend(chatId, user, session);
    if (data === "pto:registry") return screenPTORegistry(chatId, user, session);

    // Inspector
    if (data === "insp:menu") return screenInspectorMenu(chatId, user, session);
    if (data === "insp:inbox") return screenInbox(chatId, user, session, "inspector", "insp");
    if (data === "insp:send") return screenInspectorSend(chatId, user, session);
    if (data === "insp:accept") return screenInspectorAccept(chatId, user, session);
    if (data === "insp:history") return screenInspectorHistory(chatId, user, session);
    if (data.startsWith("insp:acc:")) return handleInspectorDecision(chatId, user, session, data.slice(9), "accepted");
    if (data.startsWith("insp:rej:")) return handleInspectorDecision(chatId, user, session, data.slice(9), "rejected");

    // Generic
    if (data === "g:menu") return screenGenericMenu(chatId, user, session);
    if (data === "g:dash") return screenDashboard(chatId, user, session);
    if (data === "g:alerts") return screenAlerts(chatId, user, session);
    if (data === "g:tasks") return screenTasks(chatId, user, session);
    if (data === "g:logs") return screenDailyLogs(chatId, user, session);
  }
}
