import { lookup } from "node:dns/promises";
import { assertResolvedIp, type SafeEgressPolicy } from "./safe-egress.js";

/**
 * DNS 预解析 + 解析后 SSRF 校验（规格 §23.1）。
 * - 解析全部 A/AAAA 地址；
 * - 逐项校验：拒绝回环/私有/链路本地/组播/保留/云元数据/IPv4 映射 IPv6；
 * - offline-fixture 模式（本地金标）不做 DNS 校验（127.0.0.1 直连）。
 *
 * 返回经校验允许的地址记录列表；调用方用其固定连接（单连接内结果固定，规格 §23.1）。
 */
export interface DnsAddressRecord {
  address: string;
  family: 4 | 6;
}

export async function dnsLookup(
  hostname: string,
  policy: SafeEgressPolicy,
  preferredFamily?: 4 | 6,
): Promise<DnsAddressRecord[]> {
  if (policy.mode !== "production") {
    // offline-fixture：直接放行（本地 fixture 由 assertAllowedUrl 的测试端口登记控制）。
    return [{ address: hostname, family: 4 }];
  }

  const families: Array<{ family: 4 | 6 }> = preferredFamily
    ? [{ family: preferredFamily }]
    : [{ family: 4 }, { family: 6 }];
  const results: DnsAddressRecord[] = [];
  for (const { family } of families) {
    try {
      const found = await lookup(hostname, { family, all: true });
      for (const { address } of found) {
        // 校验解析结果：私网/元数据等一律拒绝。
        assertResolvedIp(address, policy);
        results.push({ address, family });
      }
    } catch {
      // 该 family 无记录（ENOTFOUND 等），跳过。
    }
  }

  if (results.length === 0) {
    throw new Error(`DNS 解析失败或全部解析到禁止地址: ${hostname}`);
  }
  return results;
}
