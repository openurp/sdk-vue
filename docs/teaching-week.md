# weekstate 解析与教学周次计算

> 涉及工具：`src/utils/teachingWeek.ts`（`expandTeachingDates` / `getTeachingWeekNumber` /
> `normalizeTeachingWeeks` / `formatTeachingWeeks`）。

## 背景

`weekstate`（周次位图）由 beangle 平台下发，表示一门课在一学期内哪些周上课。
本文记录其**位序约定**与**教学周次换算**，作为实现与排障的唯一依据。

## 位序约定（与 beangle `WeekState` 源码一致）

`weekstate` 是 0/1 字符串（真实 API 形态），等价于 beangle 内部 `long`
（`WeekState.valueOf(s)` 即 `Long.parseLong(s, 2)`，例如字符串
`111111110000000000000` 的十进制值是 `2088960`）。

beangle 源码（`WeekState.weeks()` / `WeekTime.dates()`）语义：

1. `WeekState.toString()` = `Long.toBinaryString(value)`，**最左 = 最高位**；
2. `weeks()` 从**字符串最右**开始扫描，最右字符 = **week 0**，向左递增
   （最右第 1 个字符是 week 0，第 2 个是 week 1，…）；
3. 第 k 个上课日期 = `startOn.plusWeeks(week - 1)`：
   - week 0 → startOn **前一周**（startOn - 7 天）
   - week 1 → startOn
   - week k → startOn + (k-1)*7 天

**实现**：SDK 先将字符串 `reverse`（最右变最左），反转后第 i 位为 `'1'` 表示
week=i，上课日期 = `startOn + (i-1)*7` 天（与 `startOn` 同星期几）。

### 示例

`startOn = 2026-01-05`（周一），`weekstate = 111111111111111000000000`（24 位，15 个 1）：

- 反转 → `000000000111111111111111`；
- 反转后第 9..23 位为 `'1'` → week 9..23；
- 上课日期 = 2026-01-05 + 8..22 周 = **2026-03-02 ~ 2026-06-08**（周一）；
- 若学期 `beginOn = 2026-03-02`（周一）、`firstWeekday = Mon`，
  教学周次 = **1..15 周** ✓（课程从开学第一周开始，共 15 周）。

### 常见误区

- **不要把 weekstate 当"最左 = 第 1 周"**，也不要以为反转后第 0 位就是 startOn
  当天。beangle 中 week 从 0 开始，**week 0 对应 startOn 的前一周**，startOn 本身
  是 week 1 的上课日（`startOn.plusWeeks(week-1)`）。
- `startOn` 决定星期几与 week 1 的日期；学期起点以 `semester.beginOn` 为准。
- 十进制数形态（如 `2088960`）仅在历史/调试场景出现，`normalizeWeekstate` 会先
  转回二进制字符串，再走同一套反转逻辑。

## 教学周次换算

```text
semester.firstWeekday（Mon=周一开始，Sun=周日开始）展开自然周
        │
        ▼
上课日期 ──getTeachingWeekNumber──► 教学周次（beginOn 所在自然周 = 第 1 周）
```

- `getTeachingWeekNumber(date, semester)`：以 `semester.firstWeekday`
  （`semester.firstWeekday || semester.calendar.firstWeekday || 'Mon'`）为边界把时间轴
  展开为连续自然周，**`semester.beginOn` 所在的那个自然周即第 1 周**。
- **第一周不要求满 7 天**：例如 `firstWeekday=Mon` 但 `beginOn` 是周三（周三开学），
  该自然周（周一~周日）仍整体是第 1 周；其内早于 `beginOn` 的周一、周二也属于
  第 1 周（只是这种"开学前"的上课日期很少见）。不要用 `date - beginOn` 的绝对天数
  除以 7 来算周次，那样会把非 `firstWeekday` 开学的第一周算错。
- `normalizeTeachingWeeks`：去重、排序、过滤非正数。
- `formatTeachingWeeks`：折叠为 `1-4周` / `1-5单周` / `2-6双周` / `1,3,6周` 等文本。

### 第一周对齐示例

`beginOn = 2026-03-04`（周三开学），`firstWeekday = Mon`：

```text
3/2(一) 3/3(二) 3/4(三) 3/5(四) 3/6(五) 3/7(六) 3/8(日) 3/9(一) 3/10(二) ...
 第1周   第1周   第1周   第1周   第1周   第1周   第1周   第2周   第2周   ...
```

- 3/2、3/3 早于开学日，但与 beginOn 同属一个自然周 → 仍为第 1 周
- 3/4~3/8 → 第 1 周；3/9 起 → 第 2 周

## 相关接口

- `expandTeachingDates(startOn, weekstate)` → 上课日期数组（已按反转位序展开）
- `getTeachingWeekNumber(date, semester)` → 教学周次
- `normalizeTeachingWeeks(values)` / `formatTeachingWeeks(values)` → 周次整理与文案

消费方（如课表页）组合使用：`dates = expandTeachingDates(...)`，再
`weeks = formatTeachingWeeks(dates.map(d => getTeachingWeekNumber(d, semester)))`。
