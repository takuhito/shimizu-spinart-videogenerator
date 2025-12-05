# NotebookLM 動画生成自動化アプリ (NotebookLM Video Generator)

[![Download macOS App](https://img.shields.io/badge/Download-macOS_App-blue?style=for-the-badge&logo=apple)](https://github.com/takuhito/shimizu-spinart-videogenerator/releases/download/v1.0.0/shimizu-spinart-1.0.0-arm64.dmg)

Google NotebookLM を使用して、ブログ記事のURLから動画解説（Video Overview）を自動生成・ダウンロードするツールです。
Mac用デスクトップアプリとしてパッケージ化されています。

## 使い方 (デスクトップアプリ)

### 1. インストール
`dist/shimizu-spinart-1.0.0-arm64.dmg` を開き、アプリをアプリケーションフォルダにドラッグ＆ドロップしてください。
※ 初回起動時にセキュリティ警告が出る場合は、アプリアイコンを**右クリックして「開く」**を選択してください。

### 2. 実行
1. アプリを起動します。
2. ブログ記事のURLを入力します。
3. **Generate Video** ボタンをクリックします。
4. 自動的にブラウザが立ち上がり、NotebookLMでの生成作業が始まります。**このブラウザは閉じないでください。**
   - 初回のみ、Googleアカウントへのログインが必要です。
5. 生成が完了すると、Macの**ダウンロードフォルダ**に動画ファイル（例: `article-title.mp4`）が自動保存されます。

---

## 開発者向け情報 (For Developers)

### 前提条件
- Node.js
- Google Chrome

### セットアップ
```bash
npm install
```

### 開発モードでの実行
Web UIサーバーを起動して開発を行う場合:
```bash
npx ts-node server.ts
```
`http://localhost:3000` にアクセスしてください。

### アプリのビルド
Mac用インストーラー (.dmg) を作成する場合:
```bash
npm run build
```
`dist` フォルダにインストーラーが生成されます。

## 注意事項
- このツールはGoogle NotebookLMのUIを自動操作するため、Google側の仕様変更により動作しなくなる可能性があります。
- 動画生成には数分〜10分程度かかる場合があります。アプリが「Still waiting...」と表示していても、バックグラウンドで処理が進んでいますのでお待ちください。
