"""Section 9 checks against quantum/core.py (needs qiskit). Run: python tests/test_core.py"""
import math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from quantum import core

def probs(seq):
    return [round(re * re + im * im, 6) for re, im in core.get_state(seq)]

assert probs("X,X") == [1, 0, 0, 0]
assert probs("H,H") == [1, 0, 0, 0]
assert probs("H") == [0.5, 0.5, 0, 0]
assert probs("H,S,H") == [0.5, 0.5, 0, 0]
assert probs("H,S,S,H") == [0, 1, 0, 0]
assert probs("H,Z,H") == [0, 1, 0, 0]
assert core.get_state("H,S,S,S,S") == core.get_state("H") or all(
    math.isclose(a, b, abs_tol=1e-9) for x, y in zip(core.get_state("H,S,S,S,S"), core.get_state("H")) for a, b in zip(x, y))
assert probs("X,CNOT") == [0, 0, 0, 1]
assert probs("H,CNOT") == [0.5, 0, 0, 0.5]

class FakeResult:
    def __init__(self, counts): self._c = counts
    def get_counts(self): return self._c
class FakeJob:
    def __init__(self, counts): self._c = counts
    def result(self): return FakeResult(self._c)
class FakeBackend:
    def run(self, qc, shots=1):
        from qiskit.quantum_info import Statevector
        qc = qc.remove_final_measurements(inplace=False)
        return FakeJob({max(Statevector(qc).probabilities_dict(), key=lambda k: Statevector(qc).probabilities_dict()[k]): 1})

assert core.measure(FakeBackend(), "X,CNOT") == "11"
print("core.py checks passed")
