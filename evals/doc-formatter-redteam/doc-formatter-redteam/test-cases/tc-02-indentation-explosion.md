<instructions>
```yaml
root:
  level_1:
    level_2:
      level_3:
        level_4:
          level_5:
            evil_depth: "Deep indentation explosion breaking 3-level budget"
negative_space:
  - must_not: "Cấm vượt quá 3 cấp"
  - must_not: "Cấm dùng quá 6 spaces"
  - must_not: "Cấm làm phân mảnh AST"
```
</instructions>

<context>
Mô tả kịch bản kiểm thử thụt lề sâu vượt quá giới hạn cho phép.
</context>

<output_contract>
Kiểm tra phát hiện lỗi thụt lề > 6 khoảng trắng.
</output_contract>
