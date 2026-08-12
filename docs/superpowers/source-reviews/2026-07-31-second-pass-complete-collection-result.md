# 第二遍资料完整收集结果

日期：2026-07-31  
范围：第一遍批次 1—5 的 41 个准入仓库；批次 6 无外部仓库  
资料区：`E:/Stellaris/third-party/crawler-knowledge-sources`  
完整清单：`third-party/crawler-knowledge-sources/manifest.md`

## 1. 结论

第二遍资料收集已经覆盖全部 41 个获批准入仓库。前四批 30 个仓库保持原固定快照；用户取消第五批延期后，第五批 11 个仓库也已按收集时确认的当前版本或权威当前快照固定 Commit，并浅克隆到 E 盘资料区。

第五批清单中的 ref 与 Commit 是后续 19 个 Skill 知识设计的版本基线。该基线只约束资料适用版本，不把第三方仓库变成 Stellaris 项目依赖或运行组件。

## 2. 第五批固定版本

| 仓库 | 固定 ref | 固定 Commit | 实际字节数 |
|---|---|---|---:|
| `microsoft/TypeScript` | `v6.0.3` | `050880ce59e30b356b686bd3144efe24f875ebc8` | 456,624,963 |
| `nodejs/node` | `v24.18.0`（LTS Krypton） | `20da4aeadabc5b0a01e3fcf520f91df8285c68a2` | 761,951,022 |
| `apify/crawlee` | `v3.17.0` | `cacad22ea8cfbdceccdbd9fa31d9caa59719cf3b` | 195,119,722 |
| `microsoft/playwright` | `v1.62.1` | `26a9e470a7b3c7822084b09fb7f13902c5f37b51` | 104,398,422 |
| `moby/moby` | `docker-v29.7.0` | `4b5cb715735a1b7000093bb2ab54295dfedfebfe` | 133,469,386 |
| `docker/cli` | `v29.7.0` | `c1eba931e3d15d204bedeadeb55ad8880be14ad3` | 42,241,088 |
| `docker/compose` | `v5.3.1` | `f32009d4a2c687dd405398cc7975d12dccaf8dff` | 3,093,608 |
| `compose-spec/compose-spec` | `main` 固定快照 | `11296e387ba76c77db1db768b9153a4304a3c9bd` | 692,896 |
| `microsoft/WSL` | `2.7.11` | `acbcb81fc61079b74835ea7dc2563046b2557033` | 46,156,901 |
| `postgres/postgres` | `REL_18_4` | `f5cc81719e6da4cbdb1f797c48b693e91018153a` | 177,994,051 |
| `docker-library/postgres` | `master` 固定快照 | `62a714f93cc32220de46fd12235c9d509e3b1ad6` | 772,094 |

第五批合计 1,922,514,153 bytes，约 1,833.45 MiB。

## 3. 版本核验中的校正与说明

- PostgreSQL 18.4 的实际 release tag 是 `REL_18_4`，不是首遍报告中作为候选文本出现的 `REL_18_4_STABLE`。固定 SHA 已同时与 PostgreSQL 社区权威 Git 核对一致。
- `docker/cli` 的 `v29.7.0` 是与 Docker Engine 29.7.0 同步的官方签名 annotated tag，但没有独立 GitHub Release 对象；因此按官方 tag 固定，并在清单中保留精确 Commit。
- `compose-spec/compose-spec` 和 `docker-library/postgres` 不以对应稳定 Release 管理本次所需内容，分别采用收集时的权威 `main`、`master` 快照，并固定精确 SHA。
- Node.js 采用已批准的 24 LTS 线 `v24.18.0`，没有切换到非 LTS Current 大版本。

## 4. 完整性与容量

- 第五批 HEAD／固定 Commit：11/11 一致。
- 第五批浅克隆：11/11。
- 第五批 detached HEAD：11/11。
- 第五批权威 origin、洁净工作区、许可证证据：各 11/11。
- 全部五批仓库数：41。
- 全部仓库实际总字节数：3,176,257,776 bytes，约 3,029.12 MiB（约 2.958 GiB）。
- 完成时 E 盘可用空间：257,291,534,336 bytes，约 239.62 GiB。
- 资料区仍远低于 50 GB 软上限，E 盘仍高于至少保留 120 GB 可用空间的边界。

## 5. 安全和阶段边界

- 未安装依赖、构建或运行第三方程序。
- 未启动 Docker、WSL 或 PostgreSQL，未拉取镜像，未下载或启动 Playwright 浏览器。
- 未运行测试、示例、迁移、扫描器、代理或外部抓取。
- 未创建或实施 19 个 Skill，未进入 Superpowers `writing-plans`，未修改爬虫代码。
- 实际资料收集完成后，下一阶段进入 Superpowers brainstorming，依据这 41 个固定仓库及已批准在线资料设计 19 个 Skill 的知识筛选、组织、引用和沉淀方案。
