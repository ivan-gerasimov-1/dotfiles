return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  keys = {
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
  },
}
