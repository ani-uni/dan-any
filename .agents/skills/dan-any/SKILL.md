# dan-any 接入与使用 Skill

简短说明：本 skill 提供针对 `@dan-uni/dan-any`（v2）弹幕处理库的接入、常见用法、示例代码和注意事项，供 AI 代理或工程师在需要指导如何在项目中使用本库时调用。

## 何时使用
- 用户询问如何在项目中安装、初始化或使用 `@dan-uni/dan-any`。
- 需要把不同平台弹幕（如 Bilibili XML、DanUni PB/JSON、Dplayer 等）互相转换时。
- 需要在处理链中插入插件（合并、降级、高级过滤、统计等）。

## 快速摘要
- 核心概念：Adapter（导入）、Transformer（导出）、Plugin（在 UniChunk 上处理）。
- 主要入口：`@dan-uni/dan-any`、`@dan-uni/dan-any/adapters`、`@dan-uni/dan-any/core`、`@dan-uni/dan-any/plugins`。
- 推荐安装：`pnpm add @dan-uni/dan-any`（或 `bun add` / `vp add`）。
- 开发命令：`vp install`、`vp check`、`vp test`、`vp pack`。

## 常见接入步骤（示例）
1) 安装依赖

```bash
pnpm add @dan-uni/dan-any
# 或者 bun/pnpm/vp 按需使用
```

2) 从 Bilibili XML 导入并导出为 Danuni JSON（示例代码）

```ts
import { UniDB } from '@dan-uni/dan-any/core'
import { BiliXmlAdapter, DanuniJsonTransformerConfigurator } from '@dan-uni/dan-any/adapters'

async function biliXmlToDanuniJson(xml: string) {
  const udb = await new UniDB().init()
  try {
    const chunk = await udb.import(BiliXmlAdapter(xml))
    const json = await chunk.export(DanuniJsonTransformerConfigurator({ minify: true }))
    return json
  } finally {
    await udb.close()
  }
}
```

3) 在处理链中使用插件（合并示例）

```ts
import { mergePluginConfigurator } from '@dan-uni/dan-any/plugins'
import { DanuniJsonTransformerConfigurator } from '@dan-uni/dan-any/adapters'

const merged = await chunk.plugin(mergePluginConfigurator(10))
const result = await merged.export(DanuniJsonTransformerConfigurator({ minify: true }))
```

4) PB 双向示例（导出再导入）

```ts
import { DanuniPbTransformer, DanuniPbAdapter } from '@dan-uni/dan-any/adapters'

const pb = await chunk.export(DanuniPbTransformer)
const reimported = await udb.import(DanuniPbAdapter(pb))
```

## 高级用法/注意事项
- 默认数据库：drizzle + pglite。v2 支持 MemoryFS（默认）、NodeFS、IndexedDbFS、OpfsAhpFS，并允许接入自定义 Postgres（见测试 `tests/db.test.ts`）。
- 首次初始化实例可能有 ~1s 开销，生产中建议使用 PGLite 的 Multi-tab Worker 以复用实例。
- 打包体积：gzip ~100KB（主要为 drizzle schema）；支持 tree-shake。
- 如果对体积或启动延迟敏感，可考虑使用 v1（更轻量，针对临时小文件处理更快）。

## 常用问题与回复模板（供代理直接使用）
- 如何把 Bilibili 的 XML 转为 Danuni JSON？
  - 回复流程：1) 安装库；2) new UniDB().init(); 3) udb.import(BiliXmlAdapter(xml)); 4) chunk.export(DanuniJsonTransformerConfigurator({ minify: true })); 5) udb.close(); 并给出上文示例代码。

- 我需要在处理链里去重/合并重复弹幕怎么做？
  - 使用 `mergePluginConfigurator`，示例：`chunk.plugin(mergePluginConfigurator(阈值))`，然后再 export。

- 想把结果输出为 protobuf（pb）并重新导入怎么做？
  - 使用 `DanuniPbTransformer` 导出 pb，再用 `DanuniPbAdapter` 导入（参考上文 PB 示例）。

## 运行与测试
- 开发流程建议：

```bash
vp install
vp check
vp test
```

- 有数据库相关需求时，参考仓库内 `tests/db.test.ts` 示例了解如何传入自定义 drizzle+pglite 实例。

## 文件路径与参考
- 仓库导出路径：`@dan-uni/dan-any`（聚合），以及子路径 `adapters`、`core`、`plugins`、`utils` 等。
- 测试参考：`tests/` 目录下的测试文件包含常用使用示例。

## 额外说明（给未来维护者）
- 若要扩展该 skill 或添加更多触发句式，请编辑本文件并把新示例/FAQ 写在 `## 常见问题与回复模板` 下。
- 若需把 skill 注册到本地 agent 平台，请把本文件移动到平台要求的位置（例如：`.agents/skills/<name>/SKILL.md`）。
 
## 从测试中提取的进阶示例与选项
以下示例来自仓库 `tests/` 下的真实单元测试，展示了如何：接入自定义数据库、合并 chunk、跨实例合并、以及插件/统计的典型用法与返回结构。

- 自定义 drizzle+pglite 数据库并接入 `InitedUniDB`：

```ts
import { drizzle } from 'drizzle-orm/pglite'
import { migrateDb } from '@dan-uni/dan-any/core/db/utils'
import { InitedUniDB } from '@dan-uni/dan-any/core'

// 建立 drizzle 实例（可在你的项目里扩展 schema）
const db = drizzle({ relations: { ...baseRelations, ...relations } });
// 运行库提供的迁移以准备表
await migrateDb(db);
// 用已初始化的 db 创建 UniDB（绕过 UniDB.init 的默认 pglite 实例化）
const udb = new InitedUniDB(db);
const chunk = await udb.makeChunk({});
```

- 在自定义 schema 中添加额外表并合并关系：

测试展示了如何通过 `defineRelationsPart` 与 `defineRelations` 把自定义表合并到现有关系，并仍然通过 `migrateDb(db)` 迁移 dan-any 的表，然后单独创建/迁移自定义表。

- 合并 chunk（同一 UniDB 或跨 UniDB 实例）

```ts
// 同库合并
const chunk1 = await udb.import(BiliXmlAdapter(xml1));
const chunk2 = await udb.import(BiliXmlAdapter(xml2));
const merged = await UniChunk.assign(chunk1, [chunk2]);

// 跨库合并
const udb2 = new InitedUniDB(await initNewDb());
const chunkA = await udb.import(BiliXmlAdapter(xml1));
const chunkB = await udb2.import(BiliXmlAdapter(xml2));
const merged2 = await UniChunk.assign(chunkA, [chunkB]);
```

- 插件与统计的典型用法（来自 `plugins.test.ts`）

1) DowngradeAdvancedPlugin（高级弹幕降级）

```ts
const ori = await udb.import(DanuniJsonAdapter([...]))
const downgradedChunk = await ori.plugin(DowngradeAdvancedPluginConfigurator())
const out = await downgradedChunk.export(DanuniJsonTransformerConfigurator())
// 测试中验证了高级弹幕会被解析并附加到 content 上，如 `[B站高级弹幕] 真棒☺`
```

2) MergePlugin（合并重复弹幕）

```ts
const merged = await chunk.plugin(MergePluginConfigurator(10))
const dms = await merged.export(DanuniJsonTransformerConfigurator({ minify: true }))
// 断言示例：重复内容 "喜欢" 只保留一次
```

3) GetStatsTransformer（统计输出）

```ts
const stats = await chunk.export(GetStatsTransformerConfigurator(['mode','fontsize']))
// 返回结构示例：{ mode: Map<string, number>, fontsize: Map<number, number>, ... }
// 可以用 GetStatsUtil4getMost(stats.mode) 获取出现最多的 mode
```

4) CountTransformer（数量统计）

```ts
const count = await chunk.export(CountTransformer)
// 返回弹幕总数（number）
```

-- 小结：测试覆盖了导入（各 Adapter）、导出（各 Transformer）、插件（Merge/Downgrade/GetStats）、以及 DB 可插拔性，建议 skill 中保留这些示例以便用户按需引用。

## 格式映射与自动选择
当用户给出希望“使用”或“转换”为的弹幕格式时，按下述映射可判断库是否支持该格式的导入（Adapter）或导出（Transformer）。下表列出常见格式与对应的 Adapter/Transformer 名称（可直接从 `@dan-uni/dan-any/adapters` 导入）：

- DanUni (json): Adapter = `DanuniJsonAdapter`, Transformer = `DanuniJsonTransformerConfigurator`
- DanUni (pb): Adapter = `DanuniPbAdapter`, Transformer = `DanuniPbTransformer`
- Bilibili XML: Adapter = `BiliXmlAdapter`, Transformer = `BiliXmlTransformerConfigurator`
- Bilibili gRPC (pb): Adapter = `BiliGrpcAdapter` (导入)
- Bilibili command grpc: Adapter = `BiliCommandGrpcAdapter` (导入)
- Artplayer (json): Adapter = `ArtplayerAdapter`, Transformer = `ArtplayerTransformer`
- Dplayer (json): Adapter = `DplayerAdapter`, Transformer = `DplayerTransformer`
- DDPlay (json): Adapter = `DdplayAdapter`, Transformer = `DdplayTransformer`
- Tencent (json): Adapter = `TencentAdapter` (导入)
- VOD (json): Adapter = `VodAdapter`, Transformer = `VodTransformer`

### 选择规则
- 用户说“从 X 导入/读取/解析/接入”：优先找 `Adapter`
- 用户说“导出/转换为 X/生成 X 文件”：优先找 `Transformer`
- 用户只说“支持 X 格式吗”：同时检查两者，若某一侧不存在则说明该格式仅单向支持
- 如果格式别名很多，先做归一化再查表（例如 `b站 xml`、`bilixml`、`bili xml`、`Bili-XML` 都归为 `bili.xml`）

注意：部分格式仅支持单向（只导入或只导出），具体以上述映射为准。如果需要确认某个格式是否可导入或导出，建议在运行时按需从 `@dan-uni/dan-any/adapters` 导入对应符号并检测其是否存在。

示例：根据用户指定格式查找 Adapter/Transformer 的简单帮助函数

```ts
// helper.ts
import * as adapters from '@dan-uni/dan-any/adapters'

type AdapterFn = (...args: any[]) => Promise<any>
type TransformerFn = (...args: any[]) => Promise<any>

const formatAliases: Record<string, string> = {
  'danuni json': 'danuni.json',
  'danuni-json': 'danuni.json',
  'danuni.pb': 'danuni.pb',
  'danuni pb': 'danuni.pb',
  'b站 xml': 'bili.xml',
  'b站xml': 'bili.xml',
  'bili xml': 'bili.xml',
  'bili-xml': 'bili.xml',
  'bili grpc': 'bili.pb',
  'bili pb': 'bili.pb',
  'command grpc': 'bili.command.pb',
  'artplayer': 'artplayer',
  'dplayer': 'dplayer',
  'ddplay': 'ddplay',
  'tencent': 'tencent',
  'vod': 'vod',
}

const formatMap: Record<string, { adapter?: string; transformer?: string }> = {
  'danuni.json': { adapter: 'DanuniJsonAdapter', transformer: 'DanuniJsonTransformerConfigurator' },
  'danuni.pb': { adapter: 'DanuniPbAdapter', transformer: 'DanuniPbTransformer' },
  'bili.xml': { adapter: 'BiliXmlAdapter', transformer: 'BiliXmlTransformerConfigurator' },
  'bili.pb': { adapter: 'BiliGrpcAdapter' },
  'bili.command.pb': { adapter: 'BiliCommandGrpcAdapter' },
  'artplayer': { adapter: 'ArtplayerAdapter', transformer: 'ArtplayerTransformer' },
  'dplayer': { adapter: 'DplayerAdapter', transformer: 'DplayerTransformer' },
  'ddplay': { adapter: 'DdplayAdapter', transformer: 'DdplayTransformer' },
  'tencent': { adapter: 'TencentAdapter' },
  'vod': { adapter: 'VodAdapter', transformer: 'VodTransformer' },
}

function normalizeFormat(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replaceAll(/[_\-\/]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
}

export function resolveForFormat(format: string) {
  const normalized = normalizeFormat(format)
  const key = formatAliases[normalized] ?? normalized.replaceAll(' ', '.')
  const meta = formatMap[key]
  if (!meta) return { available: false }
  const adapter = meta.adapter ? (adapters as any)[meta.adapter] : undefined
  const transformer = meta.transformer ? (adapters as any)[meta.transformer] : undefined
  return { available: true, adapter: adapter as AdapterFn | undefined, transformer: transformer as TransformerFn | undefined }
}
```

使用示例：

```ts
const r = resolveForFormat('bili.xml')
if (!r.available) throw new Error('不支持的格式')
if (r.adapter) {
  // import data
  const chunk = await udb.import(r.adapter(xmlString))
}
if (r.transformer) {
  // export data
  const out = await chunk.export(r.transformer())
}
```

这个方法便于在交互式场景（chatbot/assistant）中根据用户自然语言输入的格式选择正确的 Adapter/Transformer，并在必要时先判断“只能导入”还是“只能导出”。

### 通配导入（推荐按 README / tests 的真实做法）
如果用户给的是“文件名 + 内容”，不要只靠格式字符串猜测，直接使用 `WildcardAdapterUtil` + `Metadata`：

- 先按文件名（`fn`）用 `Metadata.ext` / `Metadata.check.fn` 缩小候选范围
- 再按 `body` 调 `Metadata.check.body` 或 `Metadata.check.adapter` 识别具体格式
- 返回值有三种：
  - `UniChunk`：已直接导入完成，可继续做后续处理
  - `Adapter`：识别成功，但该格式需要额外参数，调用者要再补参数后手动 `udb.import(Adapter(...))`
  - `null`：未识别成功

示例（和 `tests/utils.test.ts` 对齐）：

```ts
import { UniChunk } from '@dan-uni/dan-any/core'
import { WildcardAdapterUtil } from '@dan-uni/dan-any/utils'
import {
  ArtplayerAdapter,
  ArtplayerMetadata,
  BiliXmlAdapter,
  BiliXmlMetadata,
  DanuniPbAdapter,
  DanuniPbMetadata,
  DdplayAdapter,
  DdplayMetadata,
} from '@dan-uni/dan-any/adapters'

const result = await WildcardAdapterUtil(
  udb,
  [
    [BiliXmlMetadata, BiliXmlAdapter],
    [DanuniPbMetadata, DanuniPbAdapter],
    [DdplayMetadata, DdplayAdapter],
    [ArtplayerMetadata, ArtplayerAdapter],
  ],
  fileName,
  fileBody,
)

if (result === null) {
  throw new Error('未识别到支持的弹幕格式')
}

if (result instanceof UniChunk) {
  // 已直接导入成功，继续后续插件/导出
  const dms = await result.$danmakus
}

if (result === ArtplayerAdapter) {
  // 需要额外参数时，返回的是对应 Adapter；这里补齐参数后手动导入
  const chunk = await udb.import(ArtplayerAdapter(fileBody as any, 'player-id', 'domain'))
}
```

### 选择建议
- 只有“格式名”时：用上面的格式映射表
- 有“文件名 + 内容”时：优先用 `WildcardAdapterUtil`
- 有“内容但无文件名”时：可以把候选 `Metadata` 列表缩小后只传 `body`
- 用户问“为什么识别不到”：先检查 `Metadata.ext` 是否命中，再检查 `check.body` 是否接受当前 `body` 类型

---

最后更新：基于仓库 README 与 package.json 自动生成。