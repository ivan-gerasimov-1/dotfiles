return {
  "nvim-tree/nvim-tree.lua",
  dependencies = {
    "nvim-tree/nvim-web-devicons",
  },
  config = function()
    require("nvim-tree").setup({
      view = {
        side = "right",
      },
      filters = {
        dotfiles = false,
      },
      renderer = {
        icons = {
          show = {
            file = false,
            folder = false,
            folder_arrow = true,
            git = true,
            modified = true,
            hidden = true,
            diagnostics = true,
            bookmarks = true,
          },
        },
      },
    })

    vim.keymap.set("n", "<leader>e", "<cmd>NvimTreeToggle<CR>", { desc = "Toggle explorer" })
    vim.keymap.set("n", "<leader>b", "<cmd>NvimTreeToggle<CR>", { desc = "Toggle explorer" })
    vim.keymap.set("n", "<leader>E", "<cmd>NvimTreeFocus<CR>", { desc = "Focus explorer" })
  end,
}
