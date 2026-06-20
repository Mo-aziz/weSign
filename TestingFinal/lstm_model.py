import torch
import torch.nn as nn

# ── Input shape: (N, T, features) = (N, 200, 190) ───────────────────────────
# features = 95 nodes * 2 coords (x, y) = 190
# N = batch size
# T = 200 padded frames

INPUT_SIZE  = 190   # 95 * 2
HIDDEN_SIZE = 256
NUM_LAYERS  = 2
DROPOUT     = 0.5


class SignLSTM(nn.Module):

    def __init__(self, num_classes):
        super().__init__()

        # ── Input batch norm ─────────────────────────────────────────────────
        # Normalize across the 190 input features before LSTM sees them
        self.input_bn = nn.BatchNorm1d(INPUT_SIZE)

        # ── Bidirectional LSTM ───────────────────────────────────────────────
        # Bidirectional: reads the sign sequence forward AND backward
        # Doubles the effective hidden size → hidden output = HIDDEN_SIZE * 2
        self.lstm = nn.LSTM(
            input_size    = INPUT_SIZE,
            hidden_size   = HIDDEN_SIZE,
            num_layers    = NUM_LAYERS,
            batch_first   = True,
            bidirectional = True,
            dropout       = DROPOUT if NUM_LAYERS > 1 else 0.0
        )

        # ── Attention over time steps ────────────────────────────────────────
        # Not all frames are equally important — attention lets the model
        # focus on the most discriminative frames of the sign
        # Input: HIDDEN_SIZE * 2 (bidirectional), Output: 1 score per frame
        self.attention = nn.Linear(HIDDEN_SIZE * 2, 1)

        # ── Classification head ──────────────────────────────────────────────
        self.dropout    = nn.Dropout(DROPOUT)
        self.classifier = nn.Linear(HIDDEN_SIZE * 2, num_classes)

    def forward(self, x, mask=None):
        # x shape:    (N, T, 190)
        # mask shape: (N, T)  — 1=real frame, 0=padding
        N, T, F = x.shape

        # ── Input batch norm ─────────────────────────────────────────────────
        # BN1d expects (N, F, T) — permute, normalize, permute back
        x = x.permute(0, 2, 1)       # (N, 190, T)
        x = self.input_bn(x)
        x = x.permute(0, 2, 1)       # (N, T, 190)

        # ── Zero out padding frames ──────────────────────────────────────────
        if mask is not None:
            x = x * mask.unsqueeze(2)   # (N, T, 1) broadcast over features

        # ── LSTM ─────────────────────────────────────────────────────────────
        # lstm_out shape: (N, T, HIDDEN_SIZE*2)
        lstm_out, _ = self.lstm(x)

        # ── Attention ────────────────────────────────────────────────────────
        # Compute a score for each time step
        attn_scores = self.attention(lstm_out)      # (N, T, 1)

        # Mask out padding positions before softmax
        # Set padding scores to -inf so softmax gives them ~0 weight
        if mask is not None:
            attn_scores = attn_scores.masked_fill(
                mask.unsqueeze(2) == 0, float("-inf")
            )

        attn_weights = torch.softmax(attn_scores, dim=1)   # (N, T, 1)

        # Weighted sum of LSTM outputs across time
        context = (lstm_out * attn_weights).sum(dim=1)     # (N, HIDDEN_SIZE*2)

        # ── Classification ───────────────────────────────────────────────────
        out = self.dropout(context)
        out = self.classifier(out)    # (N, num_classes)

        return out


if __name__ == "__main__":
    model = SignLSTM(num_classes=37)
    model.eval()

    x    = torch.randn(4, 200, 190)
    mask = torch.ones(4, 200)
    mask[:, 150:] = 0

    with torch.no_grad():
        out = model(x, mask)

    print(f"Input shape:  {x.shape}")
    print(f"Output shape: {out.shape}")   # should be (4, 37)

    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")