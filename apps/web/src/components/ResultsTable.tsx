import type { ResultRowView } from "@stellaris/contracts";

/**
 * 两槽位结果表（规格 §20.3）。
 * 只显示中文状态与结论；不显示 PRIMARY_1/PRIMARY_2 内部槽位与诊断字段。
 */
export function ResultsTable({
  rows,
  onViewEvidence,
}: {
  rows: ResultRowView[];
  onViewEvidence: (resultRowId: string) => Promise<void>;
}): React.ReactElement {
  return (
    <table className="results-table" aria-label="采集结果">
      <thead>
        <tr>
          <th>行政区</th>
          <th>机构</th>
          <th>岗位</th>
          <th>现任人员</th>
          <th>当前状态</th>
          <th>岗位信息 URL</th>
          <th>采集结果</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.regionCode}</td>
            <td>{row.institutionName}</td>
            <td>{row.positionDisplay}</td>
            <td>{row.personName ?? "—"}</td>
            <td>{row.currentStatusZh}</td>
            <td>
              {row.positionUrl ? (
                <a href={row.positionUrl} target="_blank" rel="noreferrer">
                  打开官网页面
                </a>
              ) : (
                ""
              )}
            </td>
            <td>{row.resultZh}</td>
            <td>
              <button type="button" onClick={() => void onViewEvidence(row.id)}>
                查看证据
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
