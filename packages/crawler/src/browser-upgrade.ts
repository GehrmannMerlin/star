/**
 * Playwright 升级条件（规格 §10.2）。
 * 满足任一条件即升级浏览器；HTTP 成功且 DOM/正文完整时不启动浏览器。
 */
export interface DocReadiness {
  bodyLength: number;
  hashRoute: boolean;
  dynamicList: boolean;
  blocked: boolean;
}

export function shouldUpgradeToPlaywright(doc: DocReadiness): boolean {
  if (doc.blocked) return true;
  if (doc.bodyLength === 0) return true; // 正文缺失
  if (doc.hashRoute) return true; // Hash 路由
  if (doc.dynamicList) return true; // 领导列表由脚本动态加载
  return false;
}
