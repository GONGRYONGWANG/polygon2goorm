# Release Checklist

Use this checklist whenever a new Chrome Web Store package is prepared.

## 1. Verify

```powershell
npm run check
npm test
```

## 2. Bump Version

Choose one:

```powershell
npm run version:patch
npm run version:minor
npm run version:major
```

Chrome Web Store requires every uploaded package to have a higher `manifest.json` version than the previous upload.

## 3. Build Package

```powershell
npm run package
```

This creates `polygon2goorm-extension.zip` and validates that required extension files are present while generated files, archives, and downloaded Polygon packages are excluded.

## 4. Commit and Tag

```powershell
git status
git add manifest.json package.json README.md RELEASE.md scripts tests src popup.js options.html options.js options.css
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push
git push --tags
```

Adjust the file list if the release changes other files.

## 5. Upload to Chrome Web Store

1. Open the Chrome Web Store Developer Dashboard.
2. Upload `polygon2goorm-extension.zip`.
3. Review permission justifications.
4. Submit for review.

## Notes

- Do not include downloaded Polygon packages in git or the release ZIP.
- Do not include local paths, tokens, cookies, or API captures containing personal data.
- If host permissions change, update the Chrome Web Store permission justifications before submitting.
