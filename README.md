# @dan-uni/dan-any

`@dan-uni/dan-any` (v2) 是一个弹幕转换与处理库，用于在不同平台格式之间导入、导出与统一处理弹幕数据。

它的核心思路是：
- 用 `Adapter` 把外部格式导入为统一数据
- 用 `Transformer` 把统一数据导出为目标格式
- 用 `Plugin` 在处理中间态（`UniChunk`）上做增强/清洗/统计

v2 使用 drizzle+pglite(支持`MemoryFS`(默认)/`NodeFS`/`IndexedDbFS`/`OpfsAhpFS`) 作为默认数据库选项，同时允许通过drizzle接入自定义postgres数据库实例  
v2 打包大小gzip后~100KB (大部分为打包后展开的drizzle schema定义)，同时支持tree-shake，故不会大幅增加软件体积  
v2 在第一次初始化实例时可能有~1s的开销，建议使用 [PGLite的Multi-tab Worker](https://pglite.dev/docs/multi-tab-worker) 使所有调用共享一个数据库实例

如果还是觉得太重了，可以使用 v1 版本，在临时小文件处理上速度更快。  

## 功能概览

### Formats 支持转换的格式

`pb`指`protobuf`格式(grpc协议下的默认传输格式)

- [x] DanUni(json,pb): `DanuniJsonAdapter` `DanuniJsonTransformerConfigurator` `DanuniPbAdapter` `DanuniPbTransformer`
- [x] bili(普通+高级弹幕,xml) `双向`: `BiliXmlAdapter` `BiliXmlTransformerConfigurator`
- [x] bili(普通+高级弹幕,pb) `正向`: `BiliGrpcAdapter`
- [x] bili(指令弹幕,pb) `正向`: `BiliCommandGrpcAdapter`
- [x] dplayer: `DplayerAdapter` `DplayerTransformer`
- [x] artplayer: `ArtplayerAdapter` `ArtplayerTransformer`
- [x] 弹弹Play: `DdplayAdapter` `DdplayTransformer`
- [x] tencent `正向`: `TencentAdapter`
- [x] [ASS(`@dan-uni/dan-any-ext-ass`)](https://github.com/ani-uni/dan-any-ext-ass) `双向(部分支持，仅该库生成的ass文件支持还原)`

### Plugins 常用插件

- `MergePluginConfigurator`（合并重复弹幕）
- `DetaoluPluginConfigurator` (基于pakku.js的弹幕过滤器): 由 [@dan-uni/dan-any-plugin-detaolu](https://github.com/ani-uni/dan-any-plugin-detaolu) 提供
- `DowngradeAdvancedPluginConfigurator`（高级弹幕降级）
- `GetStatsTransformerConfigurator`（统计输出）
- `CountTransformer`（数量统计）

## 安装

```bash
vp add @dan-uni/dan-any
bun add @dan-uni/dan-any
pnpm add @dan-uni/dan-any
```

## 快速开始

详细使用方法可以参考库中的测试文件。

### 1) 从 Bilibili XML 导入，再导出为 Danuni JSON

```ts
import { UniDB } from '@dan-uni/dan-any/core'
import {
	BiliXmlAdapter,
	DanuniJsonTransformerConfigurator,
} from '@dan-uni/dan-any/adapters'

const xml = `...bili xml弹幕文本...`

const udb = await new UniDB().init()
const chunk = await udb.import(BiliXmlAdapter(xml))
const json = await chunk.export(DanuniJsonTransformerConfigurator({ minify: true }))

console.log(json)
await udb.close()
```

### 2) 在处理链中使用插件

```ts
import { mergePluginConfigurator } from '@dan-uni/dan-any/plugins'
import { DanuniJsonTransformerConfigurator } from '@dan-uni/dan-any/adapters'

const merged = await chunk.plugin(mergePluginConfigurator(10))
const result = await merged.export(DanuniJsonTransformerConfigurator({ minify: true }))

console.log(result)
```

### 3) PB 双向示例（导出再导入）

```ts
import { DanuniPbTransformer, DanuniPbAdapter } from '@dan-uni/dan-any/adapters'

const pb = await chunk.export(DanuniPbTransformer)
const reimported = await udb.import(DanuniPbAdapter(pb))
```

### 高级: 提供兼容的drizzle+pglite实例接入自己的数据库

详见 测试文件 `tests/db.test.ts`.

## 模块入口

包已提供以下子路径导出：
- `@dan-uni/dan-any`（聚合导出）
- `@dan-uni/dan-any/adapters`
- `@dan-uni/dan-any/core`
- `@dan-uni/dan-any/plugins`
- `@dan-uni/dan-any/utils`
- `@dan-uni/dan-any/core/db/schema`
- `@dan-uni/dan-any/core/db/utils`

## 开发

```bash
vp install
vp check
vp test
vp pack
```

## 许可

`LGPL-3.0-or-later`
