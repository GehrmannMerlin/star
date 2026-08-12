param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
)

$ErrorActionPreference = 'Stop'
$errors = [System.Collections.Generic.List[string]]::new()

$paths = @{
    Skill = 'skills\crawler-curate-sources\SKILL.md'
    Workflows = 'skills\crawler-curate-sources\references\workflows.md'
    Outputs = 'skills\crawler-curate-sources\references\output-contracts.md'
    Cards = 'docs\superpowers\knowledge\evidence-cards\source-governance.md'
    View = 'docs\superpowers\knowledge\skill-views\crawler-curate-sources.md'
    Manifest = 'third-party\crawler-knowledge-sources\manifest.md'
}

foreach ($entry in $paths.GetEnumerator()) {
    $absolute = Join-Path $ProjectRoot $entry.Value
    if (-not (Test-Path -LiteralPath $absolute)) {
        $errors.Add("Missing required file: $($entry.Value)")
    }
}

if ($errors.Count -eq 0) {
    $skill = Get-Content -LiteralPath (Join-Path $ProjectRoot $paths.Skill) -Encoding UTF8 -Raw
    $workflows = Get-Content -LiteralPath (Join-Path $ProjectRoot $paths.Workflows) -Encoding UTF8 -Raw
    $outputs = Get-Content -LiteralPath (Join-Path $ProjectRoot $paths.Outputs) -Encoding UTF8 -Raw
    $cards = Get-Content -LiteralPath (Join-Path $ProjectRoot $paths.Cards) -Encoding UTF8 -Raw
    $view = Get-Content -LiteralPath (Join-Path $ProjectRoot $paths.View) -Encoding UTF8 -Raw
    $manifest = Get-Content -LiteralPath (Join-Path $ProjectRoot $paths.Manifest) -Encoding UTF8 -Raw

    if ($skill -notmatch '(?ms)^---\s*name:\s*crawler-curate-sources\s+description:.+?---') {
        $errors.Add('SKILL.md front matter is missing or invalid')
    }

    foreach ($token in @(
        '首次资料基线', '按需增量更新', '定向补充',
        '两遍式', '用户批准', '50 GB', '120 GB',
        'accepted', 'candidate', 'rejected',
        'source-governance.md', 'crawler-curate-sources.md'
    )) {
        if (-not $skill.Contains($token)) { $errors.Add("SKILL.md missing token: $token") }
    }

    foreach ($token in @(
        '权威来源', '维护状态', '许可证', '适用版本',
        '预计体积', '固定 Commit', '浅克隆', '停止条件'
    )) {
        if (-not $workflows.Contains($token)) { $errors.Add("workflows.md missing token: $token") }
    }

    foreach ($token in @(
        '准入清单', '候选清单', '拒绝清单',
        '快照清单', '证据卡', '停止报告'
    )) {
        if (-not $outputs.Contains($token)) { $errors.Add("output-contracts.md missing token: $token") }
    }

    $requiredCards = @(
        'SG-ADMISSION-001', 'SG-AUTHORITY-001', 'SG-AUTHORITY-002',
        'SG-LICENSE-001', 'SG-LICENSE-002', 'SG-SCANCODE-001',
        'SG-CURATION-001', 'SG-REUSE-001', 'SG-VERSION-001',
        'SG-CAPACITY-001', 'SG-SAFETY-001'
    )
    foreach ($id in $requiredCards) {
        $count = ([regex]::Matches($cards, "(?m)^### $id\b")).Count
        if ($count -ne 1) { $errors.Add("Evidence card $id occurs $count times") }
        if (-not $view.Contains($id)) { $errors.Add("Skill view does not reference $id") }

        $cardMatch = [regex]::Match(
            $cards,
            "(?ms)^### $id\b(?<body>.*?)(?=^### SG-|\z)"
        )
        if ($cardMatch.Success) {
            foreach ($field in @(
                '声明', '证据类型', '证据等级', '来源身份',
                '版本／ref／Commit', '原始位置', '支持说明',
                '适用条件', '限制', '关联 Skill', '状态'
            )) {
                if ($cardMatch.Groups['body'].Value -notmatch "(?m)^- $([regex]::Escape($field))：") {
                    $errors.Add("Evidence card $id missing field: $field")
                }
            }
        }
    }

    foreach ($heading in @(
        '## 触发与模式', '## 最低输入', '## 知识主题',
        '## 判断规则', '## 故障模式', '## 证据不足与冲突',
        '## 输出与交接', '## 修正与验证方向',
        '## 排除项', '## 验收'
    )) {
        if (-not $view.Contains($heading)) { $errors.Add("Skill view missing heading: $heading") }
    }

    $fixedSources = @(
        'ossf/scorecard|v5.5.0|c395761df6afe1a69e476bc60a013a94bcbc153f',
        'licensee/licensee|v10.0.0|cffd1eb1e3b52d85c4fe17f82e04cc1731cf15c4',
        'aboutcode-org/scancode-toolkit|v32.5.0|abd87fb81609ea4a29ab4cdda755c188b8be3601',
        'clearlydefined/service|v2.4.1|7e8f8631d5071f0125302ca0d677a2fd1992bd6f',
        'fsfe/reuse-tool|v6.2.0|a1bb792acda6fd0724936b4ebbdbc8eceb9c0459'
    )
    foreach ($source in $fixedSources) {
        $parts = $source.Split('|')
        foreach ($part in $parts) {
            if (-not $manifest.Contains($part)) {
                $errors.Add("Manifest missing fixed source token: $part")
            }
        }
    }

    if (-not $manifest.Contains('https://codeberg.org/fsfe/reuse-tool')) {
        $errors.Add('Manifest does not preserve Codeberg as the canonical REUSE origin')
    }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output 'PASS crawler-curate-sources contract'
exit 0
