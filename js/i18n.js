/**
 * DiffNote — UI internationalization.
 *
 * Single language setting (DiffNoteSettings.getLanguage()) drives BOTH the
 * generated change-notes language and this UI chrome.
 *
 * Usage:
 *   - Static markup: data-i18n="key" (textContent),
 *     data-i18n-attr="title:key;aria-label:key2" (attributes).
 *   - Dynamic strings in JS: DiffNoteI18n.t('key', { var: value }).
 *   - After a language change: DiffNoteI18n.apply(document).
 */
(function (global) {
  'use strict';

  const DICT = {
    'topbar.reset':     { en: 'Reset', zh: '重置', vi: 'Đặt lại', ms: 'Set semula', ja: 'リセット' },
    'topbar.notes':     { en: 'Toggle notes', zh: '切换笔记', vi: 'Bật/tắt ghi chú', ms: 'Togol nota', ja: 'ノート切替' },
    'topbar.settings':  { en: 'Settings', zh: '设置', vi: 'Cài đặt', ms: 'Tetapan', ja: '設定' },
    'topbar.theme':     { en: 'Toggle theme', zh: '切换主题', vi: 'Đổi giao diện', ms: 'Togol tema', ja: 'テーマ切替' },
    'topbar.menu':      { en: 'Toggle sidebar', zh: '切换侧栏', vi: 'Bật/tắt thanh bên', ms: 'Togol bar sisi', ja: 'サイドバー切替' },
    'topbar.language':  { en: 'Language', zh: '语言', vi: 'Ngôn ngữ', ms: 'Bahasa', ja: '言語' },

    'pwa.updateAvailable': { en: 'New version available', zh: '发现新版本', vi: 'Đã có phiên bản mới', ms: 'Versi baharu tersedia', ja: '新しいバージョンがあります' },
    'pwa.updatePrompt':    { en: 'Update now to load the latest version.', zh: '立即更新以加载最新版本。', vi: 'Cập nhật ngay để tải phiên bản mới nhất.', ms: 'Kemas kini sekarang untuk memuatkan versi terkini.', ja: '今すぐ更新して最新バージョンを読み込みます。' },
    'pwa.updateNow':       { en: 'Update Now', zh: '立即更新', vi: 'Cập nhật ngay', ms: 'Kemas Kini Sekarang', ja: '今すぐ更新' },
    'pwa.updateLater':     { en: 'Later', zh: '稍后', vi: 'Để sau', ms: 'Kemudian', ja: '後で' },
    'pwa.updating':        { en: 'Updating…', zh: '更新中…', vi: 'Đang cập nhật…', ms: 'Sedang mengemas kini…', ja: '更新中…' },
    'pwa.updateFailed':    { en: 'Update failed. Please try again.', zh: '更新失败，请重试。', vi: 'Cập nhật thất bại. Vui lòng thử lại.', ms: 'Kemas kini gagal. Sila cuba lagi.', ja: '更新に失敗しました。もう一度お試しください。' },
    'pwa.retryUpdate':     { en: 'Retry', zh: '重试', vi: 'Thử lại', ms: 'Cuba Lagi', ja: '再試行' },
    'pwa.dismissUpdate':   { en: 'Dismiss', zh: '关闭', vi: 'Bỏ qua', ms: 'Tutup', ja: '閉じる' },

    'sidebar.files':    { en: 'Files', zh: '文件', vi: 'Tệp', ms: 'Fail', ja: 'ファイル' },
    'sidebar.before':   { en: 'Before', zh: '修改前', vi: 'Trước', ms: 'Sebelum', ja: '変更前' },
    'sidebar.after':    { en: 'After', zh: '修改后', vi: 'Sau', ms: 'Selepas', ja: '変更後' },
    'sidebar.dropHint': { en: 'Drop file or click', zh: '拖入文件或点击', vi: 'Thả tệp hoặc nhấp', ms: 'Lepas fail atau klik', ja: 'ファイルをドロップ／クリック' },
    'sidebar.stats':    { en: 'Stats', zh: '统计', vi: 'Thống kê', ms: 'Statistik', ja: '統計' },
    'stat.added':       { en: 'added', zh: '新增', vi: 'thêm', ms: 'ditambah', ja: '追加' },
    'stat.deleted':     { en: 'deleted', zh: '删除', vi: 'đã xóa', ms: 'dipadam', ja: '削除' },
    'stat.blocks':      { en: 'blocks', zh: '块', vi: 'khối', ms: 'blok', ja: 'ブロック' },
    'sidebar.statsEmpty': { en: 'Compare two files to see stats.', zh: '比较两个文件以查看统计。', vi: 'So sánh hai tệp để xem thống kê.', ms: 'Bandingkan dua fail untuk lihat statistik.', ja: '2つのファイルを比較すると統計が表示されます。' },
    'sidebar.privacy':  { en: 'Local-first — files never leave your browser.', zh: '本地优先 — 文件不会离开你的浏览器。', vi: 'Ưu tiên cục bộ — tệp không rời khỏi trình duyệt.', ms: 'Setempat dahulu — fail tidak meninggalkan pelayar anda.', ja: 'ローカル優先 — ファイルはブラウザから出ません。' },

    'toolbar.lineMode':   { en: 'Line display mode', zh: '行显示模式', vi: 'Chế độ hiển thị dòng', ms: 'Mod paparan baris', ja: '行表示モード' },
    'toolbar.allLines':   { en: 'All lines', zh: '全部行', vi: 'Tất cả dòng', ms: 'Semua baris', ja: 'すべての行' },
    'toolbar.changesOnly': { en: 'Changes only', zh: '仅显示改动', vi: 'Chỉ thay đổi', ms: 'Perubahan sahaja', ja: '変更のみ' },
    'toolbar.copyDiff':  { en: 'Copy diff', zh: '复制差异', vi: 'Sao chép diff', ms: 'Salin diff', ja: '差分をコピー' },
    'toolbar.refresh':   { en: 'Refresh', zh: '重新比对', vi: 'Làm mới', ms: 'Segar semula', ja: '再比較' },
    'toolbar.refreshed': { en: 'Re-compared with the latest saved files', zh: '已用最新保存的文件重新比对', vi: 'Đã so sánh lại với tệp đã lưu mới nhất', ms: 'Dibanding semula dengan fail tersimpan terkini', ja: '最新の保存ファイルで再比較しました' },
    'toolbar.diffCopied':{ en: 'Diff copied — paste into your AI for review', zh: '差异已复制 — 可粘贴到 AI 进行审查', vi: 'Đã sao chép diff — dán vào AI để xem xét', ms: 'Diff disalin — tampal ke AI untuk semakan', ja: '差分をコピーしました — AI に貼り付けてレビュー' },
    'toolbar.nextDiff':  { en: 'Next change', zh: '下一处改动', vi: 'Thay đổi tiếp', ms: 'Perubahan seterusnya', ja: '次の変更' },
    'toolbar.prevDiff':  { en: 'Previous change', zh: '上一处改动', vi: 'Thay đổi trước', ms: 'Perubahan sebelum', ja: '前の変更' },
    'toolbar.previous':  { en: 'Previous', zh: '上一处', vi: 'Trước', ms: 'Sebelum', ja: '前へ' },
    'toolbar.next':      { en: 'Next', zh: '下一处', vi: 'Tiếp', ms: 'Seterusnya', ja: '次へ' },
    'toolbar.fileComparison': { en: 'File comparison', zh: '文件比较', vi: 'So sánh tệp', ms: 'Perbandingan fail', ja: 'ファイル比較' },
    'toolbar.changeMap': { en: 'Change map — click or drag to scroll', zh: '变更地图 — 点击或拖动滚动', vi: 'Bản đồ thay đổi — nhấp hoặc kéo để cuộn', ms: 'Peta perubahan — klik atau seret untuk menatal', ja: '変更マップ — クリックまたはドラッグしてスクロール' },

    'empty.title':      { en: 'Compare two versions of a file', zh: '比较一个文件的两个版本', vi: 'So sánh hai phiên bản của một tệp', ms: 'Bandingkan dua versi fail', ja: 'ファイルの2つのバージョンを比較' },
    'empty.desc':       { en: 'Add a Before and After file to see a visual diff and change notes.', zh: '添加修改前和修改后的文件，查看可视化差异和变更说明。', vi: 'Thêm tệp Trước và Sau để xem khác biệt trực quan và ghi chú thay đổi.', ms: 'Tambah fail Sebelum dan Selepas untuk lihat beza visual dan nota perubahan.', ja: '変更前・変更後のファイルを追加すると、差分と変更ノートが表示されます。' },

    'inspector.title':  { en: 'Change Notes', zh: '变更说明', vi: 'Ghi chú thay đổi', ms: 'Nota Perubahan', ja: '変更ノート' },
    'inspector.tabsLabel': { en: 'Change note sections', zh: '变更说明分区', vi: 'Các phần ghi chú thay đổi', ms: 'Bahagian nota perubahan', ja: '変更ノートのセクション' },
    'inspector.summary': { en: 'Summary', zh: '摘要', vi: 'Tóm tắt', ms: 'Ringkasan', ja: '概要' },
    'inspector.risks': { en: 'Risks', zh: '风险', vi: 'Rủi ro', ms: 'Risiko', ja: 'リスク' },
    'inspector.tests': { en: 'Tests', zh: '测试', vi: 'Kiểm thử', ms: 'Ujian', ja: 'テスト' },
    'inspector.commit': { en: 'Commit', zh: '提交', vi: 'Commit', ms: 'Commit', ja: 'コミット' },
    'inspector.placeholder': { en: 'Change notes appear here after you compare two files.', zh: '比较两个文件后，变更说明显示在这里。', vi: 'Ghi chú thay đổi hiện ở đây sau khi bạn so sánh hai tệp.', ms: 'Nota perubahan muncul di sini selepas anda bandingkan dua fail.', ja: '2つのファイルを比較すると、ここに変更ノートが表示されます。' },
    'inspector.risksPlaceholder': { en: 'Risk items appear here after analysis.', zh: '分析后将在此显示风险项目。', vi: 'Các mục rủi ro sẽ xuất hiện sau khi phân tích.', ms: 'Item risiko muncul di sini selepas analisis.', ja: '分析後にリスク項目が表示されます。' },
    'inspector.testsPlaceholder': { en: 'Verification suggestions appear here after analysis.', zh: '分析后将在此显示验证建议。', vi: 'Gợi ý xác minh sẽ xuất hiện sau khi phân tích.', ms: 'Cadangan pengesahan muncul di sini selepas analisis.', ja: '分析後に検証候補が表示されます。' },
    'inspector.commitPlaceholder': { en: 'A concise commit message appears here after analysis.', zh: '分析后将在此显示简洁的提交信息。', vi: 'Thông điệp commit súc tích sẽ xuất hiện sau khi phân tích.', ms: 'Mesej commit ringkas muncul di sini selepas analisis.', ja: '分析後に簡潔なコミットメッセージが表示されます。' },

    'notes.overview':   { en: 'Overview', zh: '概述', vi: 'Tổng quan', ms: 'Gambaran', ja: '概要' },
    'notes.breakdown':  { en: 'Change Breakdown', zh: '变更明细', vi: 'Chi tiết thay đổi', ms: 'Pecahan Perubahan', ja: '変更内訳' },
    'notes.keyChanges': { en: 'Key Changes', zh: '关键变更', vi: 'Thay đổi chính', ms: 'Perubahan Utama', ja: '主な変更' },
    'notes.highestRisk': { en: 'Highest Risk', zh: '最高风险', vi: 'Rủi ro cao nhất', ms: 'Risiko Tertinggi', ja: '最大のリスク' },
    'notes.commit':     { en: 'Commit Message', zh: '提交信息', vi: 'Thông điệp commit', ms: 'Mesej Commit', ja: 'コミットメッセージ' },
    'notes.risks':      { en: 'Risk Notes', zh: '风险提示', vi: 'Lưu ý rủi ro', ms: 'Nota Risiko', ja: 'リスクメモ' },
    'notes.tests':      { en: 'Test Suggestions', zh: '测试建议', vi: 'Gợi ý kiểm thử', ms: 'Cadangan Ujian', ja: 'テスト提案' },

    'generate.btn':     { en: 'Generate with {provider}', zh: '用 {provider} 生成', vi: 'Tạo bằng {provider}', ms: 'Jana dengan {provider}', ja: '{provider} で生成' },
    'generate.loading': { en: 'Generating…', zh: '生成中…', vi: 'Đang tạo…', ms: 'Menjana…', ja: '生成中…' },
    'generate.regenAnalysis': { en: 'Regenerate analysis', zh: '重新生成分析', vi: 'Tạo lại phân tích', ms: 'Jana semula analisis', ja: '分析を再生成' },
    'notes.generating': { en: 'Generating change notes with AI…', zh: '正在用 AI 生成变更说明…', vi: 'Đang tạo ghi chú bằng AI…', ms: 'Menjana nota dengan AI…', ja: 'AI で変更ノートを生成中…' },
    'copy.label':       { en: 'Copy', zh: '复制', vi: 'Sao chép', ms: 'Salin', ja: 'コピー' },
    'copy.done':        { en: 'Copied ✓', zh: '已复制 ✓', vi: 'Đã sao chép ✓', ms: 'Disalin ✓', ja: 'コピー済み ✓' },
    'copy.failed':      { en: 'Copy failed', zh: '复制失败', vi: 'Sao chép thất bại', ms: 'Gagal salin', ja: 'コピー失敗' },

    'settings.title':     { en: 'Settings', zh: '设置', vi: 'Cài đặt', ms: 'Tetapan', ja: '設定' },
    'settings.provider':  { en: 'LLM Provider', zh: 'LLM 提供方', vi: 'Nhà cung cấp LLM', ms: 'Pembekal LLM', ja: 'LLM プロバイダ' },
    'settings.endpoint':  { en: 'Endpoint', zh: '端点', vi: 'Điểm cuối', ms: 'Titik akhir', ja: 'エンドポイント' },
    'settings.model':     { en: 'Model', zh: '模型', vi: 'Mô hình', ms: 'Model', ja: 'モデル' },
    'settings.apikey':    { en: 'API key', zh: 'API 密钥', vi: 'Khóa API', ms: 'Kunci API', ja: 'API キー' },
    'settings.bakedNote': { en: 'Uses the built-in gateway key (XOR-obfuscated in source).', zh: '使用内置网关密钥（源码中 XOR 混淆）。', vi: 'Dùng khóa cổng tích hợp (làm rối XOR trong mã nguồn).', ms: 'Guna kunci get terbina (dikaburkan XOR dalam sumber).', ja: '組み込みゲートウェイキーを使用（ソース内でXOR難読化）。' },
    'settings.effort':    { en: 'Reasoning Effort', zh: '推理强度', vi: 'Mức suy luận', ms: 'Tahap Penaakulan', ja: '推論の強さ' },
    'settings.thinking':  { en: 'Thinking Level', zh: '思考级别', vi: 'Mức suy nghĩ', ms: 'Tahap Pemikiran', ja: '思考レベル' },
    'level.default':      { en: 'Default', zh: '默认', vi: 'Mặc định', ms: 'Lalai', ja: '既定' },
    'level.none':         { en: 'None', zh: '关闭', vi: 'Tắt', ms: 'Tiada', ja: 'なし' },
    'level.low':          { en: 'Low', zh: '低', vi: 'Thấp', ms: 'Rendah', ja: '低' },
    'level.medium':       { en: 'Medium', zh: '中', vi: 'Trung bình', ms: 'Sederhana', ja: '中' },
    'level.high':         { en: 'High', zh: '高', vi: 'Cao', ms: 'Tinggi', ja: '高' },
    'settings.language':  { en: 'Change Notes Language (i18n)', zh: '变更说明语言 (i18n)', vi: 'Ngôn ngữ ghi chú (i18n)', ms: 'Bahasa Nota (i18n)', ja: '変更ノートの言語 (i18n)' },
    'settings.commitLang': { en: 'Commit Message Language', zh: '提交信息语言', vi: 'Ngôn ngữ thông điệp commit', ms: 'Bahasa Mesej Commit', ja: 'コミットメッセージの言語' },
    'settings.sameAsNotes': { en: 'Same as change notes', zh: '与变更说明相同', vi: 'Giống ghi chú thay đổi', ms: 'Sama seperti nota perubahan', ja: '変更ノートと同じ' },
    'settings.commitLen': { en: 'Commit Message Length', zh: '提交信息长度', vi: 'Độ dài thông điệp commit', ms: 'Panjang Mesej Commit', ja: 'コミットメッセージの長さ' },
    'settings.chars':     { en: 'chars', zh: '字符', vi: 'ký tự', ms: 'aksara', ja: '文字' },
    'settings.commitPrompt': { en: 'Commit Message Prompt', zh: '提交信息提示词', vi: 'Prompt thông điệp commit', ms: 'Prompt Mesej Commit', ja: 'コミットメッセージのプロンプト' },
    'settings.placeholders': { en: 'Placeholders:', zh: '占位符：', vi: 'Trình giữ chỗ:', ms: 'Pemegang tempat:', ja: 'プレースホルダー：' },
    'settings.reset':     { en: 'Reset to default', zh: '恢复默认', vi: 'Khôi phục mặc định', ms: 'Set semula lalai', ja: '既定に戻す' },
    'settings.security':  { en: 'Security: API keys are XOR-obfuscated in local storage, not encrypted. The Default gateway key is recoverable from the page source — treat it as a rate-limited / throwaway key and rotate it. Do not store sensitive production keys here.', zh: '安全：API 密钥在本地存储中仅做 XOR 混淆，并非加密。Default 网关密钥可从页面源码还原 —— 请把它当作限额/一次性密钥并定期轮换。请勿在此存放敏感的生产密钥。', vi: 'Bảo mật: Khóa API chỉ được làm rối XOR trong bộ nhớ cục bộ, không mã hóa. Khóa cổng Mặc định có thể khôi phục từ mã nguồn — hãy xem nó như khóa giới hạn/dùng một lần và xoay vòng. Đừng lưu khóa sản xuất nhạy cảm ở đây.', ms: 'Keselamatan: Kunci API hanya dikaburkan XOR dalam storan setempat, bukan disulitkan. Kunci get Default boleh dipulihkan dari sumber halaman — anggap ia kunci terhad/buang dan putarkannya. Jangan simpan kunci produksi sensitif di sini.', ja: 'セキュリティ：APIキーはローカルストレージ内でXOR難読化されているだけで、暗号化ではありません。Defaultゲートウェイキーはページソースから復元可能です — レート制限付き／使い捨てキーとして扱い、定期的に交換してください。重要な本番キーをここに保存しないでください。' },
    'settings.test':      { en: 'Test connection', zh: '测试连接', vi: 'Kiểm tra kết nối', ms: 'Uji sambungan', ja: '接続テスト' },
    'settings.save':      { en: 'Save', zh: '保存', vi: 'Lưu', ms: 'Simpan', ja: '保存' },
    'settings.close':     { en: 'Close settings', zh: '关闭设置', vi: 'Đóng cài đặt', ms: 'Tutup tetapan', ja: '設定を閉じる' },

    'status.saved':      { en: 'Saved ✓', zh: '已保存 ✓', vi: 'Đã lưu ✓', ms: 'Disimpan ✓', ja: '保存しました ✓' },
    'status.saveFailed': { en: 'Save failed (storage unavailable).', zh: '保存失败（存储不可用）。', vi: 'Lưu thất bại (không có bộ nhớ).', ms: 'Gagal simpan (storan tiada).', ja: '保存失敗（ストレージ利用不可）。' },
    'status.testing':    { en: 'Testing…', zh: '测试中…', vi: 'Đang kiểm tra…', ms: 'Sedang uji…', ja: 'テスト中…' },
    'status.connected':  { en: 'Connected ✓ (reply: {reply})', zh: '已连接 ✓（回复：{reply}）', vi: 'Đã kết nối ✓ (trả lời: {reply})', ms: 'Bersambung ✓ (balas: {reply})', ja: '接続成功 ✓（応答：{reply}）' },
    'status.failed':     { en: 'Failed ✗ — {msg}', zh: '失败 ✗ — {msg}', vi: 'Thất bại ✗ — {msg}', ms: 'Gagal ✗ — {msg}', ja: '失敗 ✗ — {msg}' },

    'error.aiFailed':     { en: 'AI generation failed: {msg}', zh: 'AI 生成失败：{msg}', vi: 'Tạo AI thất bại: {msg}', ms: 'Penjanaan AI gagal: {msg}', ja: 'AI 生成に失敗：{msg}' },
    'error.fileTooLarge': { en: 'File too large ({kb} KB). Limit is 2 MB.', zh: '文件过大（{kb} KB）。上限为 2 MB。', vi: 'Tệp quá lớn ({kb} KB). Giới hạn 2 MB.', ms: 'Fail terlalu besar ({kb} KB). Had 2 MB.', ja: 'ファイルが大きすぎます（{kb} KB）。上限は2 MBです。' },
    'error.fileRead':     { en: 'Could not read file.', zh: '无法读取文件。', vi: 'Không thể đọc tệp.', ms: 'Tidak dapat baca fail.', ja: 'ファイルを読み取れません。' },
    'error.refreshStale': { en: 'Could not re-read the file — drag the amended file in again.', zh: '无法重新读取文件 — 请把修改后的文件重新拖进来。', vi: 'Không thể đọc lại tệp — kéo tệp đã sửa vào lại.', ms: 'Tidak dapat baca semula fail — seret semula fail yang dipinda.', ja: 'ファイルを再読み込みできません — 修正後のファイルを再度ドラッグしてください。' },
  };

  function lang() {
    try { return global.DiffNoteSettings ? global.DiffNoteSettings.getLanguage() : 'en'; }
    catch (e) { return 'en'; }
  }

  function t(key, vars) {
    const entry = DICT[key];
    let s = entry ? (entry[lang()] || entry.en) : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
    // Reflect language on <html lang> for a11y / hyphenation.
    document.documentElement.setAttribute('lang', lang());
  }

  global.DiffNoteI18n = { t, apply, DICT };

  // Apply to the static markup as soon as this script runs (scripts are at
  // the end of <body>, so the DOM is already parsed).
  apply(document);
})(typeof self !== 'undefined' ? self : this);
