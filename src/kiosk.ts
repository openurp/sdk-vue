/**
 * 扫码登录（kiosk）模块：独立设备扫码登录 EMS CAS。
 *
 * - API 层：qrLogin（创建二维码 / SSE 订阅 / 状态查询 / 换取会话）
 * - Composable：useQrLogin（状态机封装：SSE 优先、轮询降级、lastQrcodeId 刷新）
 */
export * from './api/qrLogin'
export { useQrLogin } from './composables/useQrLogin'
export type { UseQrLogin, UseQrLoginOptions } from './composables/useQrLogin'
