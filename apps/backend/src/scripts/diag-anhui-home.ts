/**
 * 真实安徽首页结构诊断（R-21 授权：只读 www.ah.gov.cn）。
 * 分析首页导航链接分类，校准机构发现选择器。
 */
import { createSafeEgressPolicy } from "@stellaris/crawler/safe-egress.js";
import { httpFetch } from "@stellaris/crawler/http-fetch.js";
import { extractPageFacts } from "@stellaris/crawler/page-facts.js";

async function main(): Promise<void> {
  const policy = createSafeEgressPolicy({ mode: "production" });
  const url = "https://www.ah.gov.cn/";
  const res = await httpFetch(url, policy);
  const facts = await extractPageFacts(res.body);
  console.log(`[diag] 首页 HTTP ${res.status}, 最终URL ${res.fetchUrl}`);
  console.log(`[diag] 标题: ${facts.title}, 正文 ${facts.bodyText.length} 字符`);
  console.log(`[diag] links 总数: ${facts.links.length}`);

  // 按锚文本分类链接。
  const govLinks = facts.links.filter((l) => /厅|委员会|局|署|办公厅|办公室/.test(l.anchor) && l.anchor.length <= 20);
  console.log(`[diag] 机构类链接: ${govLinks.length} 个`);
  for (const g of govLinks.slice(0, 25)) console.log(`  ${g.anchor} → ${g.href}`);

  // 第一个链接样例（判断选择器命中何种文本）。
  console.log(`[diag] 前 20 个链接:`);
  for (const l of facts.links.slice(0, 20)) console.log(`  "${l.anchor}" → ${l.href}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("[diag] 失败:", e); process.exit(1); });
