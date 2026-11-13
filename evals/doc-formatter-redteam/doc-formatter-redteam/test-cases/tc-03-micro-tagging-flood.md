<instructions>
```yaml
task: "Micro-tagging Flood Attack"
negative_space:
  - must_not: "Cấm phân mảnh bằng thẻ vụn"
  - must_not: "Cấm dùng quá 12 thẻ"
  - must_not: "Cấm làm loãng attention heads"
```
</instructions>

<context>
<tag1>Val1</tag1>
<tag2>Val2</tag2>
<tag3>Val3</tag3>
<tag4>Val4</tag4>
<tag5>Val5</tag5>
<tag6>Val6</tag6>
<tag7>Val7</tag7>
<tag8>Val8</tag8>
<tag9>Val9</tag9>
<tag10>Val10</tag10>
<tag11>Val11</tag11>
<tag12>Val12</tag12>
<tag13>Val13</tag13>
<tag14>Val14</tag14>
<tag15>Val15</tag15>
</context>

<output_contract>
Kiểm tra bắt lỗi Micro-tagging khi vượt quá 12 thẻ phân biệt.
</output_contract>
