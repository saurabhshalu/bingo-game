import PropTypes from "prop-types";

const Number = ({ number }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
    >
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="300%"
      >
        {number}
      </text>
    </svg>
  );
};

export default Number;

Number.propTypes = {
  number: PropTypes.number.isRequired,
};
