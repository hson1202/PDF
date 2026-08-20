export type ShortcutItem = {
  keys: string
  label: string
  hint?: string
}

export type ShortcutGroup = {
  title: string
  items: ShortcutItem[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Xem trang & căn lề',
    items: [
      { keys: 'Ctrl + +', label: 'Phóng to' },
      { keys: 'Ctrl + −', label: 'Thu nhỏ' },
      { keys: 'Ctrl + 0', label: 'Kích thước thực 100%', hint: 'Không phóng, không thu' },
      { keys: 'Ctrl + 1', label: 'Vừa toàn trang', hint: 'Cả trang vừa khít cửa sổ' },
      { keys: 'Ctrl + 2', label: 'Vừa chiều rộng', hint: 'Căn theo chiều ngang, cuộn dọc để xem hết' },
      { keys: 'Ctrl + lăn chuột', label: 'Phóng to / thu nhỏ nhanh' },
      { keys: 'PageDown', label: 'Sang trang sau' },
      { keys: 'PageUp', label: 'Về trang trước' },
      { keys: 'Home', label: 'Về trang đầu' },
      { keys: 'End', label: 'Tới trang cuối' },
    ],
  },
  {
    title: 'Tệp & chỉnh sửa',
    items: [
      { keys: 'Ctrl + O', label: 'Mở PDF' },
      { keys: 'Ctrl + S', label: 'Tải xuống PDF' },
      { keys: 'Ctrl + Z', label: 'Hoàn tác' },
      { keys: 'Ctrl + Y', label: 'Làm lại' },
      { keys: 'Delete', label: 'Xóa đối tượng đang chọn' },
      { keys: 'Esc', label: 'Về công cụ Chọn / đóng hộp thoại' },
      { keys: '?', label: 'Mở / đóng danh sách phím tắt' },
    ],
  },
  {
    title: 'Công cụ',
    items: [
      { keys: 'V', label: 'Chọn', hint: 'Kéo / xóa highlight, chữ, ảnh, chữ ký đã thêm' },
      { keys: 'E', label: 'Sửa chữ', hint: 'Bấm vào chữ gốc trên PDF để sửa' },
      { keys: 'H', label: 'Highlight', hint: 'Bôi đen chữ để tô màu' },
      { keys: 'U', label: 'Gạch chân', hint: 'Bôi đen chữ để gạch chân' },
      { keys: 'D', label: 'Vẽ' },
      { keys: 'T', label: 'Thêm chữ', hint: 'Chèn hộp chữ mới' },
      { keys: 'N', label: 'Ghi chú' },
      { keys: 'I', label: 'Chèn ảnh' },
      { keys: 'K', label: 'Chữ ký' },
      { keys: 'F', label: 'Điền form', hint: 'Chỉ PDF tờ khai/đơn có sẵn ô trống' },
    ],
  },
]

export const TOOL_SHORTCUTS: Record<string, string> = {
  select: 'V',
  editText: 'E',
  highlight: 'H',
  underline: 'U',
  draw: 'D',
  text: 'T',
  sticky: 'N',
  image: 'I',
  signature: 'K',
  form: 'F',
}
