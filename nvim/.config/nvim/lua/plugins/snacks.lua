return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  keys = {
    {
      "<leader>ff",
      function()
        Snacks.picker.files()
      end,
      desc = "Find files",
    },
    {
      "<leader>fg",
      function()
        Snacks.picker.grep()
      end,
      desc = "Search text",
    },
    {
      "<leader>fb",
      function()
        Snacks.picker.buffers()
      end,
      desc = "Find buffer",
    },
    {
      "<leader>fh",
      function()
        Snacks.picker.help()
      end,
      desc = "Search help",
    },
    {
      "<leader>ft",
      function()
        Snacks.picker.grep({ search = "\\b(TODO|FIXME|HACK|NOTE|WARN)\\b", live = false })
      end,
      desc = "Find TODOs",
    },
    {
      "<leader>gg",
      function()
        Snacks.lazygit()
      end,
      desc = "Open LazyGit",
    },
    {
      "<leader>gf",
      function()
        Snacks.lazygit.log_file()
      end,
      desc = "LazyGit current file",
    },
  },
  opts = {
    image = {
      doc = {
        -- render mermaid/image blocks inline in markdown buffers
        enabled = true,
        inline = true,
        float = true,
      },
    },
    -- also takes over vim.ui.select (code actions and the like)
    picker = {
      enabled = true,
      icons = {
        -- no icon provider is installed, so every file would get the same generic glyph
        files = { enabled = false },
      },
    },
  },
}
