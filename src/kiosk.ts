/**
 * 扫码登录（kiosk）模块：独立设备扫码登录 EMS CAS。
 *
 * 实现在 `@beangle/ems-app`：
 * - API 层：qrLogin（创建二维码 / SSE 订阅 / 状态查询 / 换取会话）
 * - Composable：useQrLogin（状态机封装：SSE 优先、轮询降级、lastQrcodeId 刷新）
 *
 * 这里只做再导出，保持 `@openurp/sdk-vue/kiosk` 子入口可用。
 */
export {
  buildQrLoginUrl,
  buildQrStreamUrl,
  createQrLogin,
  fetchQrLoginStatus,
  useQrLogin,
} from '@beangle/ems-app'
export type {
  QrLoginApiOptions,
  QrLoginSession,
  QrLoginStatus,
  QrLoginStatusResult,
  UseQrLogin,
  UseQrLoginOptions,
} from '@beangle/ems-app'
