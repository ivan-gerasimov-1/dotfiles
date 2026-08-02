return {
  "mikavilpas/yazi.nvim",
  event = "VeryLazy",
  dependencies = {
    "nvim-lua/plenary.nvim",
  },
  keys = {
    { "<leader>e", "<cmd>Yazi<CR>", desc = "Open Yazi" },
    { "<leader>E", "<cmd>Yazi cwd<CR>", desc = "Open Yazi at cwd" },
    { "<C-up>", "<cmd>Yazi toggle<CR>", desc = "Resume Yazi" },
  },
  opts = {
    open_for_directories = true,
  },
}
