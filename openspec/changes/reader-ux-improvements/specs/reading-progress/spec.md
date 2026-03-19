## MODIFIED Requirements

### Requirement: 進度百分比計算
進度百分比 SHALL 使用各 section 的位元組大小加權計算，而非等權除以 section 總數。

#### Scenario: 短 section 佔比小
- **WHEN** 使用者翻完版權頁（2KB）和目錄（5KB）進入正文
- **THEN** 進度百分比約為 1~2%，而非之前的 12~18%

#### Scenario: 長章節佔比大
- **WHEN** 使用者在一個 80KB 的長章節中翻到一半
- **THEN** 進度百分比增加約 8%（80KB/2/totalSize），反映實際閱讀量

#### Scenario: 直排橫排切換後百分比一致
- **WHEN** 使用者在直排模式閱讀到 34% 後切換為橫排
- **THEN** 切換後百分比仍約為 34%（±2% 容許誤差）
