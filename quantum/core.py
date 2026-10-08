"""Qiskit side of Quantum Gate Maze.

The gate sequence is a comma separated string such as "H,CNOT".
Qubit 0 is the world (|0> Day, |1> Night), qubit 1 is the magic door.
"""
from qiskit import QuantumCircuit

try:
    from qiskit.quantum_info import Statevector
except Exception as exc:  # the game falls back to game/qsim.js for state
    Statevector = None
    print("quantum.core: Statevector import failed, JS fallback will be used:", exc)


def build(seq):
    qc = QuantumCircuit(2)
    for g in [s for s in seq.split(",") if s]:
        if g == "X": qc.x(0)
        elif g == "H": qc.h(0)
        elif g == "S": qc.s(0)
        elif g == "Z": qc.z(0)
        elif g == "CNOT": qc.cx(0, 1)
        elif g == "XD": qc.x(1)
    return qc


def get_state(seq):
    if Statevector is None:
        raise RuntimeError("qiskit.quantum_info.Statevector is not available")
    sv = Statevector(build(seq))
    return [[float(a.real), float(a.imag)] for a in sv.data]


def measure(backend, seq):
    qc = build(seq)
    qc.measure_all()
    counts = backend.run(qc, shots=1).result().get_counts()
    return list(counts.keys())[0]
