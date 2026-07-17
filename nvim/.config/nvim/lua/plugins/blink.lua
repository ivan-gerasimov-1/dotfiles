return {
  "saghen/blink.cmp",
  version = "1.*",
  opts = {
    keymap = {
      preset = "default",
      -- Keep arrow keys predictable while learning: completion uses C-n/C-p.
      ["<Up>"] = false,
      ["<Down>"] = false,
    },
    completion = {
      documentation = {
        auto_show = true,
      },
    },
  },
}
